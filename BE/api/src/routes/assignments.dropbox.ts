import type { FastifyPluginAsync } from "fastify";

import { callGeminiForBrief } from "../lib/aiBrief.js";
import { getAiBrief, upsertAiBrief } from "../lib/aiBriefStore.js";
import { formatIsoInClientPrefs, readClientPrefs } from "../lib/clientPrefs.js";
import { connectorRequest } from "../lib/connectorClient.js";
import { AppError, isAppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readIdentifier(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((part) => Number(part));
  const bParts = b.split(".").map((part) => Number(part));

  const maxLen = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < maxLen; index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left !== right) {
      return left - right;
    }
  }

  return 0;
}

function findLatestLeVersion(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const candidates: string[] = [];
  const productVersions = record["ProductVersions"];

  if (Array.isArray(productVersions)) {
    for (const entry of productVersions) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) {
        continue;
      }

      const code = readString(entryRecord["ProductCode"])?.toLowerCase();
      if (code !== "le") {
        continue;
      }

      const latest = readString(entryRecord["LatestVersion"]);
      if (latest) {
        candidates.push(latest);
      }

      const versions = entryRecord["Versions"];
      if (Array.isArray(versions)) {
        versions.forEach((version) => {
          const parsed = readString(version);
          if (parsed) {
            candidates.push(parsed);
          }
        });
      }
    }
  }

  const leRecord = asRecord(record["le"]);
  if (leRecord) {
    const latest = readString(leRecord["LatestVersion"]);
    if (latest) {
      candidates.push(latest);
    }
  }

  const sorted = Array.from(new Set(candidates)).sort((a, b) => compareVersions(a, b));
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function buildVersionsToTry(primary: string | null): string[] {
  const defaults = [
    "1.90",
    "1.89",
    "1.88",
    "1.87",
    "1.86",
    "1.85",
    "1.84",
    "1.83",
    "1.82",
    "1.81",
    "1.80",
    "1.79",
    "1.78",
    "1.77",
    "1.76",
    "1.75",
    "1.74",
    "1.72",
    "1.71",
    "1.70",
    "1.68",
    "1.65",
    "1.62",
    "1.60",
    "1.58",
    "1.55",
    "1.52",
    "1.50",
    "1.48",
    "1.45",
    "1.42",
    "1.40",
    "1.35",
    "1.30",
    "1.28"
  ];

  const merged = [primary, ...defaults].filter((value): value is string => typeof value === "string");
  const unique = Array.from(new Set(merged));
  return unique.sort((a, b) => compareVersions(b, a));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoOrNull(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function mapDropboxType(value: unknown): "individual" | "group" | "unknown" {
  // Observed values: 2 = individual folder, 1 = group folder.
  if (value === 2) {
    return "individual";
  }
  if (value === 1) {
    return "group";
  }
  return "unknown";
}

function mapSubmissionType(value: unknown):
  | "file"
  | "text"
  | "on_paper"
  | "observed"
  | "file_or_text"
  | "unknown" {
  // Brightspace SubmissionType enum (observed): 0..4
  switch (value) {
    case 0:
      return "file";
    case 1:
      return "text";
    case 2:
      return "on_paper";
    case 3:
      return "observed";
    case 4:
      return "file_or_text";
    default:
      return "unknown";
  }
}

function mapCompletionType(value: unknown):
  | "on_submission"
  | "due_date"
  | "manually_by_learner"
  | "on_evaluation"
  | "unknown" {
  // Brightspace CompletionType enum (observed): 0..3
  switch (value) {
    case 0:
      return "on_submission";
    case 1:
      return "due_date";
    case 2:
      return "manually_by_learner";
    case 3:
      return "on_evaluation";
    default:
      return "unknown";
  }
}

async function fetchDropboxFolder(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  orgUnitId: string;
  folderId: string;
}): Promise<{ leVersion: string; folder: JsonRecord }> {
  const versionsResponse = await connectorRequest<unknown>({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    apiPath: "/d2l/api/versions/"
  });

  const latestLeVersion = findLatestLeVersion(versionsResponse.data);
  const versionsToTry = buildVersionsToTry(latestLeVersion);

  let last404: unknown = null;

  for (const version of versionsToTry) {
    try {
      const response = await connectorRequest<unknown>({
        instanceUrl: input.instanceUrl,
        storageState: input.storageState,
        apiPath: `/d2l/api/le/${version}/${input.orgUnitId}/dropbox/folders/${input.folderId}`
      });

      const folder = asRecord(response.data);
      if (!folder) {
        throw new AppError(502, "dropbox api returned unexpected payload", "dropbox_invalid_payload");
      }

      return {
        leVersion: version,
        folder
      };
    } catch (error) {
      if (isAppError(error) && error.code === "session_expired") {
        throw new AppError(401, "session expired", "session_expired");
      }

      if (isAppError(error) && error.statusCode === 403) {
        throw new AppError(403, "dropbox access forbidden", "dropbox_forbidden");
      }

      if (isAppError(error) && error.statusCode === 404) {
        last404 = error;
        continue;
      }

      throw error;
    }
  }

  if (last404) {
    throw new AppError(404, "assignment not found", "dropbox_folder_not_found");
  }

  throw new AppError(502, "dropbox api unavailable on this instance", "dropbox_api_unavailable");
}

function parseRubrics(assessment: unknown): Array<{
  rubricId: string;
  name: string;
  criteria: Array<{ id: string; name: string; exemplaryText: string | null }>;
}> {
  const assessmentRecord = asRecord(assessment);
  if (!assessmentRecord) {
    return [];
  }

  const rubricsRaw = assessmentRecord["Rubrics"];
  if (!Array.isArray(rubricsRaw)) {
    return [];
  }

  const rubrics: Array<{
    rubricId: string;
    name: string;
    criteria: Array<{ id: string; name: string; exemplaryText: string | null }>;
  }> = [];

  for (const rubricRaw of rubricsRaw) {
    const rubric = asRecord(rubricRaw);
    if (!rubric) {
      continue;
    }

    const rubricId = readIdentifier(rubric["RubricId"]) ?? null;
    const name = readString(rubric["Name"]) ?? null;
    if (!rubricId || !name) {
      continue;
    }

    const groupsRaw = rubric["CriteriaGroups"];
    const groups = Array.isArray(groupsRaw) ? groupsRaw : [];

    const criteria: Array<{ id: string; name: string; exemplaryText: string | null }> = [];

    for (const groupRaw of groups) {
      const group = asRecord(groupRaw);
      if (!group) {
        continue;
      }

      const levelsRaw = group["Levels"];
      const levels = Array.isArray(levelsRaw) ? levelsRaw.map(asRecord).filter(Boolean) as JsonRecord[] : [];

      const maxLevelId =
        levels
          .map((level) => ({
            id: readIdentifier(level["Id"]),
            points: readNumber(level["Points"])
          }))
          .filter((entry): entry is { id: string; points: number } => !!entry.id && entry.points !== null)
          .sort((a, b) => b.points - a.points)[0]?.id ?? null;

      const criteriaRaw = group["Criteria"];
      const groupCriteria = Array.isArray(criteriaRaw) ? criteriaRaw : [];

      for (const criterionRaw of groupCriteria) {
        const criterion = asRecord(criterionRaw);
        if (!criterion) {
          continue;
        }

        const id = readIdentifier(criterion["Id"]) ?? null;
        const criterionName = readString(criterion["Name"]) ?? null;
        if (!id || !criterionName) {
          continue;
        }

        const cellsRaw = criterion["Cells"];
        const cells = Array.isArray(cellsRaw) ? cellsRaw.map(asRecord).filter(Boolean) as JsonRecord[] : [];

        const bestCell =
          (maxLevelId ? cells.find((cell) => readIdentifier(cell["LevelId"]) === maxLevelId) : null) ??
          cells[0] ??
          null;

        let exemplaryText: string | null = null;
        const description = bestCell ? asRecord(bestCell["Description"]) : null;
        if (description) {
          exemplaryText =
            readString(description["Text"]) ??
            (readString(description["Html"]) ? stripHtml(readString(description["Html"]) ?? "") : null);
        }

        criteria.push({
          id,
          name: criterionName,
          exemplaryText
        });
      }
    }

    rubrics.push({
      rubricId,
      name,
      criteria
    });
  }

  return rubrics;
}

function parseAttachments(folder: JsonRecord): Array<{
  kind: "file";
  fileId: string;
  name: string;
  sizeBytes: number;
}> {
  const raw = folder["Attachments"];
  const attachments = Array.isArray(raw) ? raw : [];
  const parsed: Array<{ kind: "file"; fileId: string; name: string; sizeBytes: number }> = [];

  for (const item of attachments) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const fileId = readIdentifier(record["FileId"]) ?? null;
    const name = readString(record["FileName"]) ?? readString(record["Name"]) ?? null;
    const size = readNumber(record["Size"]) ?? readNumber(record["SizeBytes"]) ?? null;

    if (!fileId || !name || size === null) {
      continue;
    }

    parsed.push({
      kind: "file",
      fileId,
      name,
      sizeBytes: size
    });
  }

  return parsed;
}

function parseLinkAttachments(folder: JsonRecord): Array<{
  kind: "link";
  linkId: string;
  name: string;
  href: string;
}> {
  const raw = folder["LinkAttachments"];
  const attachments = Array.isArray(raw) ? raw : [];
  const parsed: Array<{ kind: "link"; linkId: string; name: string; href: string }> = [];

  for (const item of attachments) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const linkId = readIdentifier(record["LinkId"]) ?? null;
    const name = readString(record["Title"]) ?? readString(record["Name"]) ?? null;
    const href = readString(record["Href"]) ?? null;

    if (!linkId || !name || !href) {
      continue;
    }

    parsed.push({
      kind: "link",
      linkId,
      name,
      href
    });
  }

  return parsed;
}

const dropboxAssignmentsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/assignments/dropbox/:orgUnitId/:folderId",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { orgUnitId?: string; folderId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const folderId = (params.folderId ?? "").trim();

      if (!orgUnitId || !folderId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        throw new AppError(400, "connect to d2l first", "not_connected");
      }

      const course = await prisma.course.findFirst({
        where: {
          userId: user.id,
          brightspaceCourseId: orgUnitId
        },
        select: {
          courseName: true,
          courseCode: true
        }
      });

      if (!course) {
        throw new AppError(400, "sync courses first", "unknown_org_unit");
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);
      const { folder } = await fetchDropboxFolder({
        instanceUrl: user.institutionUrl,
        storageState,
        orgUnitId,
        folderId
      });

      const availability = asRecord(folder["Availability"]);
      const assessment = asRecord(folder["Assessment"]);
      const instructions = asRecord(folder["CustomInstructions"]);

      const instructionsText = instructions ? readString(instructions["Text"]) : null;
      const instructionsHtml = instructions ? readString(instructions["Html"]) : null;

      const rubrics = parseRubrics(assessment);

      return {
        orgUnitId,
        folderId,
        courseName: course.courseName,
        courseCode: course.courseCode ?? null,
        title: readString(folder["Name"]) ?? readString(folder["Title"]) ?? "untitled assignment",
        dueAt: toIsoOrNull(folder["DueDate"]),
        availableFrom: availability ? toIsoOrNull(availability["StartDate"]) : null,
        availableUntil: availability ? toIsoOrNull(availability["EndDate"]) : null,
        pointsPossible: assessment ? readNumber(assessment["ScoreDenominator"]) : null,
        submissionType: mapSubmissionType(folder["SubmissionType"]),
        completionType: mapCompletionType(folder["CompletionType"]),
        dropboxType: mapDropboxType(folder["DropboxType"]),
        instructionsText: instructionsText && instructionsText.length > 0 ? instructionsText : null,
        instructionsHtml: instructionsHtml && instructionsHtml.length > 0 ? instructionsHtml : null,
        rubrics,
        attachments: parseAttachments(folder),
        linkAttachments: parseLinkAttachments(folder)
      };
    }
  );

  fastify.get(
    "/assignments/dropbox/:orgUnitId/:folderId/ai/brief",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { orgUnitId?: string; folderId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const folderId = (params.folderId ?? "").trim();

      if (!orgUnitId || !folderId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const cached = await getAiBrief({
        userId: request.auth.user.id,
        targetType: "dropbox",
        targetKey: `${orgUnitId}:${folderId}`
      });

      if (!cached) {
        throw new AppError(404, "brief not found", "brief_not_found");
      }

      return cached;
    }
  );

  fastify.post(
    "/assignments/dropbox/:orgUnitId/:folderId/ai/brief",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
      if (!apiKey) {
        throw new AppError(501, "ai not configured", "ai_not_configured");
      }

      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

      const params = request.params as { orgUnitId?: string; folderId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const folderId = (params.folderId ?? "").trim();

      if (!orgUnitId || !folderId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        throw new AppError(400, "connect to d2l first", "not_connected");
      }

      const course = await prisma.course.findFirst({
        where: {
          userId: user.id,
          brightspaceCourseId: orgUnitId
        },
        select: {
          courseName: true,
          courseCode: true
        }
      });

      if (!course) {
        throw new AppError(400, "sync courses first", "unknown_org_unit");
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);

      try {
        const { folder } = await fetchDropboxFolder({
          instanceUrl: user.institutionUrl,
          storageState,
          orgUnitId,
          folderId
        });

        const availability = asRecord(folder["Availability"]);
        const assessment = asRecord(folder["Assessment"]);
        const instructions = asRecord(folder["CustomInstructions"]);

        const title = readString(folder["Name"]) ?? readString(folder["Title"]) ?? "untitled assignment";
        const dueAt = toIsoOrNull(folder["DueDate"]);
        const availableFrom = availability ? toIsoOrNull(availability["StartDate"]) : null;
        const availableUntil = availability ? toIsoOrNull(availability["EndDate"]) : null;
        const pointsPossible = assessment ? readNumber(assessment["ScoreDenominator"]) : null;
        const submissionType = mapSubmissionType(folder["SubmissionType"]);

        const instructionsText = instructions ? readString(instructions["Text"]) : null;

        const rubrics = parseRubrics(assessment);
        const rubricCriteriaLines: string[] = [];
        rubrics.forEach((rubric) => {
          rubric.criteria.slice(0, 30).forEach((criterion) => {
            if (!criterion.exemplaryText) {
              return;
            }
            rubricCriteriaLines.push(`${criterion.name}: ${criterion.exemplaryText}`);
          });
        });

        const clip = (value: string, max: number) =>
          value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;

        const prefs = readClientPrefs(request);
        const dueLocal = formatIsoInClientPrefs(dueAt, prefs);
        const startLocal = formatIsoInClientPrefs(availableFrom, prefs);
        const endLocal = formatIsoInClientPrefs(availableUntil, prefs);

        const contextParts: string[] = [
          "Important: Use the provided LOCAL time strings as-is; do not convert between time zones.",
          `Client timezone: ${prefs.timeZone ?? "unknown"}`,
          `Client locale: ${prefs.locale ?? "unknown"}`,
          `Due (local): ${dueLocal ?? "unknown"}`,
          `Availability (local): ${startLocal ?? "unknown"} -> ${endLocal ?? "unknown"}`,
          "",
          `Title: ${title}`,
          `Course: ${course.courseCode ? `${course.courseCode} · ` : ""}${course.courseName}`,
          `Due (iso): ${dueAt ?? "unknown"}`,
          `Points: ${pointsPossible !== null ? pointsPossible : "unknown"}`,
          `Submission type: ${submissionType}`,
          `Availability (iso): ${availableFrom ?? "unknown"} -> ${availableUntil ?? "unknown"}`,
          "",
          "Instructions:",
          instructionsText ? clip(instructionsText, 3500) : "(no instructions text provided in this dropbox folder)",
          "",
          "Rubric criteria (exemplary):",
          rubricCriteriaLines.length > 0
            ? clip(rubricCriteriaLines.slice(0, 18).join("\n- "), 3500)
            : "(no rubric text available)"
        ];

        const payload = await callGeminiForBrief({
          apiKey,
          model,
          contextText: contextParts.join("\n")
        });

        await upsertAiBrief({
          userId: user.id,
          targetType: "dropbox",
          targetKey: `${orgUnitId}:${folderId}`,
          provider: "gemini",
          model,
          brief: payload
        });

        return payload;
      } catch (error) {
        if (isAppError(error) && error.code === "session_expired") {
          throw new AppError(401, "session expired", "session_expired");
        }

        throw error;
      }
    }
  );
};

export default dropboxAssignmentsRoute;
