import { aiBriefSchema } from "./aiBrief.js";
import { formatIsoInClientPrefs } from "./clientPrefs.js";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

type JsonRecord = Record<string, unknown>;

export type CopilotIntent = "planning" | "assignment_help" | "navigation";

export interface CopilotCitation {
  id: string;
  type: "course" | "timeline_event" | "ai_brief" | "item_state";
  label: string;
  href: string | null;
  internalPath: string | null;
}

export interface CopilotTurnResult {
  answer: string;
  actions: string[];
  citations: CopilotCitation[];
  followUps: string[];
  confidence: "high" | "medium" | "low";
  contextSnapshot: JsonRecord;
  model: string;
  latencyMs: number;
}

export const MAX_COPILOT_MESSAGE_LENGTH = 4000;
export const COPILOT_MAX_CONTEXT_ITEMS = 40;
export const COPILOT_MAX_HISTORY_MESSAGES = 12;

type CopilotEvidence = {
  id: string;
  type: CopilotCitation["type"];
  label: string;
  text: string;
  score: number;
  href: string | null;
  internalPath: string | null;
};

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeGeminiModelName(model: string): string {
  const trimmed = model.trim();
  return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function keywordScore(text: string, tokens: string[]): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
}

function detectIntent(message: string): CopilotIntent {
  const lower = message.toLowerCase();
  if (/\b(where|find|open|link|resource|module|lecture|notes?|slides?|content)\b/.test(lower)) {
    return "navigation";
  }
  if (/\b(assignment|rubric|deliverable|submission|dropbox|essay|report|project)\b/.test(lower)) {
    return "assignment_help";
  }
  return "planning";
}

function buildInternalPathFromTimelineEvent(input: {
  sourceType: string;
  sourceId: string;
  orgUnitId: string;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
}): string | null {
  if (input.sourceType === "dropbox_folder" || input.associatedEntityType === "D2L.LE.Dropbox.Dropbox") {
    const folderId = input.associatedEntityId ?? input.sourceId;
    return `/dashboard/assignments/overview/${encodeURIComponent(input.orgUnitId)}/${encodeURIComponent(folderId)}`;
  }

  if (input.sourceType === "quiz" || input.associatedEntityType === "D2L.LE.Quizzing.Quiz") {
    const quizId = input.associatedEntityId ?? input.sourceId;
    return `/dashboard/quizzes/overview/${encodeURIComponent(input.orgUnitId)}/${encodeURIComponent(quizId)}`;
  }

  if (
    input.sourceType === "content_topic" ||
    input.associatedEntityType === "D2L.LE.Content.ContentObject.TopicCO"
  ) {
    const topicId = input.associatedEntityId ?? input.sourceId;
    return `/dashboard/content/overview/${encodeURIComponent(input.orgUnitId)}/${encodeURIComponent(topicId)}`;
  }

  if (input.sourceType === "calendar") {
    return `/dashboard/calendar/overview/${encodeURIComponent(input.sourceId)}`;
  }

  return null;
}

function buildInternalPathFromTarget(targetType: string, targetKey: string): string | null {
  if (targetType === "calendar_event") {
    return `/dashboard/calendar/overview/${encodeURIComponent(targetKey)}`;
  }

  const [orgUnitId, childId] = targetKey.split(":");
  if (!orgUnitId || !childId) {
    return null;
  }

  if (targetType === "dropbox") {
    return `/dashboard/assignments/overview/${encodeURIComponent(orgUnitId)}/${encodeURIComponent(childId)}`;
  }
  if (targetType === "quiz") {
    return `/dashboard/quizzes/overview/${encodeURIComponent(orgUnitId)}/${encodeURIComponent(childId)}`;
  }
  if (targetType === "content_topic") {
    return `/dashboard/content/overview/${encodeURIComponent(orgUnitId)}/${encodeURIComponent(childId)}`;
  }
  return null;
}

type CopilotResponseDraft = {
  answer: string;
  actions: string[];
  citationIds: string[];
  followUps: string[];
  confidence: "high" | "medium" | "low";
};

function copilotResponseJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["answer", "actions", "citationIds", "followUps", "confidence"],
    properties: {
      answer: { type: "string" },
      actions: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { type: "string" }
      },
      citationIds: {
        type: "array",
        minItems: 0,
        maxItems: 12,
        items: { type: "string" }
      },
      followUps: {
        type: "array",
        minItems: 0,
        maxItems: 5,
        items: { type: "string" }
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"]
      }
    }
  };
}

function extractGeminiCandidateText(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const candidates = record["candidates"];
  if (!Array.isArray(candidates)) {
    return null;
  }

  const first = asRecord(candidates[0]);
  if (!first) {
    return null;
  }

  const content = asRecord(first["content"]);
  if (!content) {
    return null;
  }

  const parts = content["parts"];
  if (!Array.isArray(parts)) {
    return null;
  }

  for (const part of parts) {
    const partRecord = asRecord(part);
    if (!partRecord) {
      continue;
    }
    const text = readString(partRecord["text"]);
    if (text) {
      return text;
    }
  }

  return null;
}

async function callGeminiForCopilot(input: {
  apiKey: string;
  model: string;
  message: string;
  history: Array<{ role: string; content: string }>;
  contextText: string;
}): Promise<CopilotResponseDraft> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let response: Response;

  try {
    const model = normalizeGeminiModelName(input.model) || "gemini-2.5-flash";
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": input.apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "You are Clarus AI Copilot for student planning.\n" +
                  "Use only provided context evidence. Never invent due dates, weights, or policies.\n" +
                  "If data is missing, state what is missing and how to verify in Brightspace.\n" +
                  "Return concise, practical guidance.\n" +
                  "When citing evidence, use only provided evidence IDs in citationIds.\n\n" +
                  `Conversation history (latest first relevance):\n${input.history
                    .map((m) => `${m.role}: ${clip(m.content, 400)}`)
                    .join("\n")}\n\n` +
                  `User question:\n${input.message}\n\n` +
                  `Evidence context:\n${input.contextText}`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: copilotResponseJsonSchema(),
          temperature: 0.2
        }
      })
    });
  } catch {
    throw new AppError(502, "ai provider unavailable", "ai_provider_unavailable");
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.trim().length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new AppError(502, "ai provider request failed", "ai_provider_failed");
  }

  const draftSchema = {
    answer: (value: unknown) => readString(value),
    actions: (value: unknown) =>
      Array.isArray(value)
        ? value.map((v) => readString(v)).filter((v): v is string => Boolean(v)).slice(0, 6)
        : [],
    citationIds: (value: unknown) =>
      Array.isArray(value)
        ? value.map((v) => readString(v)).filter((v): v is string => Boolean(v)).slice(0, 12)
        : [],
    followUps: (value: unknown) =>
      Array.isArray(value)
        ? value.map((v) => readString(v)).filter((v): v is string => Boolean(v)).slice(0, 5)
        : [],
    confidence: (value: unknown): "high" | "medium" | "low" => {
      if (value === "high" || value === "medium" || value === "low") {
        return value;
      }
      return "medium";
    }
  };

  const parseDraft = (value: unknown): CopilotResponseDraft | null => {
    const record = asRecord(value);
    if (!record) return null;
    const answer = draftSchema.answer(record["answer"]);
    const actions = draftSchema.actions(record["actions"]);
    if (!answer || actions.length === 0) return null;
    return {
      answer,
      actions,
      citationIds: draftSchema.citationIds(record["citationIds"]),
      followUps: draftSchema.followUps(record["followUps"]),
      confidence: draftSchema.confidence(record["confidence"])
    };
  };

  const direct = parseDraft(parsed);
  if (direct) {
    return direct;
  }

  const candidateText = extractGeminiCandidateText(parsed);
  if (!candidateText) {
    throw new AppError(422, "ai refused", "ai_refused");
  }

  let json: unknown;
  try {
    const cleaned = candidateText
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    json = JSON.parse(cleaned);
  } catch {
    throw new AppError(502, "ai provider returned invalid json", "ai_invalid_json");
  }

  const fromCandidate = parseDraft(json);
  if (!fromCandidate) {
    throw new AppError(502, "ai provider returned invalid json", "ai_invalid_json");
  }

  return fromCandidate;
}

export function generateThreadTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, "")
    .trim();
  if (!cleaned) {
    return "New chat";
  }
  const words = cleaned.split(" ").slice(0, 8).join(" ");
  return clip(words, 70);
}

export async function buildCopilotContext(input: {
  userId: string;
  message: string;
  activeOrgUnitId?: string | null;
  clientPrefs?: { timeZone: string | null; locale: string | null };
}): Promise<{
  intent: CopilotIntent;
  contextText: string;
  evidences: CopilotEvidence[];
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const prefs = input.clientPrefs ?? { timeZone: null, locale: null };
  const intent = detectIntent(input.message);
  const tokens = tokenize(input.message);

  const [courses, timelineEvents, aiBriefs, itemStates] = await Promise.all([
    prisma.course.findMany({
      where: { userId: input.userId, isActive: true },
      select: { brightspaceCourseId: true, courseName: true, courseCode: true },
      take: 50
    }),
    prisma.timelineEvent.findMany({
      where: {
        userId: input.userId,
        ...(input.activeOrgUnitId ? { brightspaceOrgUnitId: input.activeOrgUnitId } : {}),
        startAt: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      include: {
        course: {
          select: {
            courseCode: true,
            courseName: true
          }
        }
      },
      orderBy: [{ startAt: "asc" }],
      take: 120
    }),
    prisma.aiBrief.findMany({
      where: { userId: input.userId },
      orderBy: [{ generatedAt: "desc" }],
      take: 20
    }),
    prisma.itemState.findMany({
      where: { userId: input.userId },
      orderBy: [{ updatedAt: "desc" }],
      take: 30
    })
  ]);

  const evidences: CopilotEvidence[] = [];

  for (const course of courses) {
    const label = `${course.courseCode ?? course.courseName ?? "Course"} (${course.brightspaceCourseId})`;
    const text = `Active course: ${course.courseCode ?? ""} ${course.courseName ?? ""}`.trim();
    evidences.push({
      id: `course:${course.brightspaceCourseId}`,
      type: "course",
      label,
      text,
      score: 1 + keywordScore(`${label} ${text}`, tokens),
      href: null,
      internalPath: "/dashboard"
    });
  }

  for (const event of timelineEvents) {
    const courseLabel = event.course?.courseCode ?? event.course?.courseName ?? event.brightspaceOrgUnitId;
    const whenLocal = formatIsoInClientPrefs(event.startAt.toISOString(), prefs) ?? event.startAt.toISOString();
    const label = `${event.title} · ${courseLabel}`;
    const dueSoonDays = (event.startAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    let score = intent === "planning" ? 3 : 2;
    if (dueSoonDays >= 0 && dueSoonDays <= 3) score += 2;
    if (dueSoonDays < 0) score += 1;
    score += keywordScore(`${event.title} ${courseLabel} ${event.description ?? ""}`, tokens);

    evidences.push({
      id: `event:${event.sourceType}:${event.sourceId}:${event.dateKind}`,
      type: "timeline_event",
      label,
      text: `${event.dateKind.toUpperCase()} at ${whenLocal}. ${event.description ?? ""}`.trim(),
      score,
      href: event.viewUrl,
      internalPath: buildInternalPathFromTimelineEvent({
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        orgUnitId: event.brightspaceOrgUnitId,
        associatedEntityType: event.associatedEntityType,
        associatedEntityId: event.associatedEntityId
      })
    });
  }

  for (const brief of aiBriefs) {
    const parsed = aiBriefSchema.safeParse(brief.briefJson);
    if (!parsed.success) {
      continue;
    }
    const data = parsed.data;
    const label = `AI brief (${brief.targetType})`;
    const text = `TLDR: ${data.tldr}\nDeliverables: ${data.deliverables.slice(0, 4).join("; ")}`;
    let score = intent === "assignment_help" ? 4 : 2;
    score += keywordScore(text, tokens);

    evidences.push({
      id: `brief:${brief.targetType}:${brief.targetKey}`,
      type: "ai_brief",
      label,
      text: clip(text, 500),
      score,
      href: null,
      internalPath: buildInternalPathFromTarget(brief.targetType, brief.targetKey)
    });
  }

  for (const state of itemStates) {
    const checkedIds = Array.isArray(state.checkedIds)
      ? state.checkedIds.filter((value): value is string => typeof value === "string")
      : [];
    const notes = readString(state.notesText) ?? "";
    const location = readString(state.locationText) ?? "";
    if (!notes && !location && checkedIds.length === 0) {
      continue;
    }

    const text = `Location: ${location || "n/a"}\nNotes: ${notes || "n/a"}\nChecklist done: ${checkedIds.length}`;
    let score = intent === "assignment_help" ? 3 : 2;
    score += keywordScore(text, tokens);

    evidences.push({
      id: `state:${state.targetType}:${state.targetKey}`,
      type: "item_state",
      label: `Student notes (${state.targetType})`,
      text: clip(text, 500),
      score,
      href: null,
      internalPath: buildInternalPathFromTarget(state.targetType, state.targetKey)
    });
  }

  const top = [...evidences]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, COPILOT_MAX_CONTEXT_ITEMS);

  const contextLines = [
    `Intent: ${intent}`,
    `Now: ${formatIsoInClientPrefs(now.toISOString(), prefs) ?? now.toISOString()}`,
    "Rules: Use only evidence below. Cite evidence IDs in citationIds.",
    "",
    "Evidence:"
  ];

  for (const evidence of top) {
    contextLines.push(
      `- [${evidence.id}] ${evidence.type} | ${clip(evidence.label, 160)} | ${clip(evidence.text, 550)} | internal: ${
        evidence.internalPath ?? "none"
      } | href: ${evidence.href ?? "none"}`
    );
  }

  return {
    intent,
    contextText: contextLines.join("\n"),
    evidences: top
  };
}

export async function runCopilotTurn(input: {
  userId: string;
  threadId: string;
  message: string;
  activeOrgUnitId?: string | null;
  clientPrefs?: { timeZone: string | null; locale: string | null };
}): Promise<CopilotTurnResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new AppError(501, "ai not configured", "ai_not_configured");
  }

  const model = process.env.GEMINI_MODEL_COPILOT?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  const historyRows = await prisma.copilotMessage.findMany({
    where: {
      userId: input.userId,
      threadId: input.threadId
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: COPILOT_MAX_HISTORY_MESSAGES
  });

  const history = historyRows
    .reverse()
    .map((row) => ({ role: row.role, content: clip(row.content, 1200) }))
    .filter((row) => row.role === "user" || row.role === "assistant");

  const context = await buildCopilotContext({
    userId: input.userId,
    message: input.message,
    activeOrgUnitId: input.activeOrgUnitId,
    clientPrefs: input.clientPrefs
  });

  const started = Date.now();
  const draft = await callGeminiForCopilot({
    apiKey,
    model,
    message: input.message,
    history,
    contextText: context.contextText
  });
  const latencyMs = Date.now() - started;

  const evidenceById = new Map<string, CopilotEvidence>();
  context.evidences.forEach((e) => evidenceById.set(e.id, e));

  const citations: CopilotCitation[] = draft.citationIds
    .map((id) => {
      const evidence = evidenceById.get(id);
      if (!evidence) return null;
      return {
        id: evidence.id,
        type: evidence.type,
        label: evidence.label,
        href: evidence.href,
        internalPath: evidence.internalPath
      };
    })
    .filter((value): value is CopilotCitation => Boolean(value))
    .slice(0, 8);

  return {
    answer: draft.answer,
    actions: draft.actions,
    citations,
    followUps: draft.followUps,
    confidence: draft.confidence,
    contextSnapshot: {
      intent: context.intent,
      evidenceIds: context.evidences.map((e) => e.id),
      evidenceCount: context.evidences.length,
      activeOrgUnitId: input.activeOrgUnitId ?? null,
      actions: draft.actions,
      followUps: draft.followUps,
      confidence: draft.confidence
    },
    model,
    latencyMs
  };
}
