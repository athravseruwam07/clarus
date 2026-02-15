import { z } from "zod";

import { AppError } from "./errors.js";

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

export const aiBriefSchema = z.object({
  tldr: z.string().trim().min(1),
  deliverables: z.array(z.string().trim().min(1)).min(1).max(6),
  checklist: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        details: z.string().trim().min(1).nullable(),
        category: z.enum([
          "planning",
          "research",
          "writing",
          "practice",
          "rubric",
          "submission",
          "review",
          "admin"
        ]),
        estimatedMinutes: z.number().int().positive().max(600).nullable()
      })
    )
    .min(8)
    .max(14),
  schedule: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        durationMinutes: z.number().int().positive().max(360),
        objective: z.string().trim().min(1)
      })
    )
    .min(2)
    .max(5),
  questionsToClarify: z.array(z.string().trim().min(1)).max(8),
  riskFlags: z.array(z.string().trim().min(1)).max(8)
});

export type AiBrief = z.infer<typeof aiBriefSchema>;

export function aiBriefJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["tldr", "deliverables", "checklist", "schedule", "questionsToClarify", "riskFlags"],
    properties: {
      tldr: { type: "string" },
      deliverables: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { type: "string" }
      },
      checklist: {
        type: "array",
        minItems: 8,
        maxItems: 14,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "details", "category", "estimatedMinutes"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            details: { type: ["string", "null"] },
            category: {
              type: "string",
              enum: ["planning", "research", "writing", "practice", "rubric", "submission", "review", "admin"]
            },
            estimatedMinutes: { type: ["integer", "null"] }
          }
        }
      },
      schedule: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "durationMinutes", "objective"],
          properties: {
            label: { type: "string" },
            durationMinutes: { type: "integer" },
            objective: { type: "string" }
          }
        }
      },
      questionsToClarify: {
        type: "array",
        minItems: 0,
        maxItems: 8,
        items: { type: "string" }
      },
      riskFlags: {
        type: "array",
        minItems: 0,
        maxItems: 8,
        items: { type: "string" }
      }
    }
  };
}

function normalizeGeminiModelName(model: string): string {
  const trimmed = model.trim();
  return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
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

export async function callGeminiForBrief(input: {
  apiKey: string;
  model: string;
  contextText: string;
}): Promise<AiBrief> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

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
                  "You generate concise, actionable academic briefings for students. " +
                  "Use ONLY the provided context; do not invent requirements. " +
                  "If key details are missing, add them as questionsToClarify. " +
                  "Return JSON that exactly matches the provided schema.\n\n" +
                  "CONTEXT:\n" +
                  input.contextText
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: aiBriefJsonSchema(),
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

  const directParsed = aiBriefSchema.safeParse(parsed);
  if (directParsed.success) {
    return directParsed.data;
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

  return aiBriefSchema.parse(json);
}

