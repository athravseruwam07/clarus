import type { FastifyPluginAsync } from "fastify";

import { callGeminiForBrief } from "../lib/aiBrief.js";
import { getAiBrief, upsertAiBrief } from "../lib/aiBriefStore.js";
import { formatIsoInClientPrefs, readClientPrefs } from "../lib/clientPrefs.js";
import { connectorRequest } from "../lib/connectorClient.js";
import { getWorkingLeVersion } from "../lib/d2lVersions.js";
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

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchQuiz(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  orgUnitId: string;
  quizId: string;
}): Promise<JsonRecord> {
  const leVersion = await getWorkingLeVersion({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    probeApiPath: (version) => `/d2l/api/le/${version}/${input.orgUnitId}/quizzes/${input.quizId}`
  });

  const response = await connectorRequest<unknown>({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    apiPath: `/d2l/api/le/${leVersion}/${input.orgUnitId}/quizzes/${input.quizId}`
  });

  const quiz = asRecord(response.data);
  if (!quiz) {
    throw new AppError(502, "quiz api returned unexpected payload", "quiz_invalid_payload");
  }

  return quiz;
}

const quizzesOverviewRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/quizzes/:orgUnitId/:quizId",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { orgUnitId?: string; quizId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const quizId = (params.quizId ?? "").trim();

      if (!orgUnitId || !quizId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        throw new AppError(400, "connect to d2l first", "not_connected");
      }

      const course = await prisma.course.findFirst({
        where: { userId: user.id, brightspaceCourseId: orgUnitId },
        select: { courseName: true, courseCode: true }
      });
      if (!course) {
        throw new AppError(400, "sync courses first", "unknown_org_unit");
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);
      const quiz = await fetchQuiz({
        instanceUrl: user.institutionUrl,
        storageState,
        orgUnitId,
        quizId
      });

      const description = asRecord(quiz["Description"]);
      const instructions = asRecord(quiz["Instructions"]);

      const descriptionText =
        (description ? readString(description["Text"]) : null) ??
        (description ? (readString(description["Html"]) ? stripHtml(readString(description["Html"]) ?? "") : null) : null);
      const instructionsText =
        (instructions ? readString(instructions["Text"]) : null) ??
        (instructions ? (readString(instructions["Html"]) ? stripHtml(readString(instructions["Html"]) ?? "") : null) : null);

      return {
        orgUnitId,
        quizId,
        courseName: course.courseName,
        courseCode: course.courseCode ?? null,
        title: readString(quiz["Name"]) ?? "untitled quiz",
        dueAt: toIsoOrNull(quiz["DueDate"]),
        startAt: toIsoOrNull(quiz["StartDate"]),
        endAt: toIsoOrNull(quiz["EndDate"]),
        isActive: quiz["IsActive"] === true,
        descriptionText,
        instructionsText,
        // Direct quiz link (more useful than calendar details view).
        openUrl: `${new URL(user.institutionUrl).origin}/d2l/lms/quizzing/quizzing.d2l?ou=${encodeURIComponent(
          orgUnitId
        )}&qi=${encodeURIComponent(quizId)}`
      };
    }
  );

  fastify.get(
    "/quizzes/:orgUnitId/:quizId/ai/brief",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { orgUnitId?: string; quizId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const quizId = (params.quizId ?? "").trim();

      if (!orgUnitId || !quizId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const cached = await getAiBrief({
        userId: request.auth.user.id,
        targetType: "quiz",
        targetKey: `${orgUnitId}:${quizId}`
      });

      if (!cached) {
        throw new AppError(404, "brief not found", "brief_not_found");
      }

      return cached;
    }
  );

  fastify.post(
    "/quizzes/:orgUnitId/:quizId/ai/brief",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
      if (!apiKey) {
        throw new AppError(501, "ai not configured", "ai_not_configured");
      }

      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

      const params = request.params as { orgUnitId?: string; quizId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const quizId = (params.quizId ?? "").trim();

      if (!orgUnitId || !quizId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        throw new AppError(400, "connect to d2l first", "not_connected");
      }

      const course = await prisma.course.findFirst({
        where: { userId: user.id, brightspaceCourseId: orgUnitId },
        select: { courseName: true, courseCode: true }
      });
      if (!course) {
        throw new AppError(400, "sync courses first", "unknown_org_unit");
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);

      try {
        const quiz = await fetchQuiz({
          instanceUrl: user.institutionUrl,
          storageState,
          orgUnitId,
          quizId
        });

        const description = asRecord(quiz["Description"]);
        const instructions = asRecord(quiz["Instructions"]);

        const title = readString(quiz["Name"]) ?? "quiz";
        const dueAt = toIsoOrNull(quiz["DueDate"]);
        const startAt = toIsoOrNull(quiz["StartDate"]);
        const endAt = toIsoOrNull(quiz["EndDate"]);

        const descriptionText =
          (description ? readString(description["Text"]) : null) ??
          (description ? (readString(description["Html"]) ? stripHtml(readString(description["Html"]) ?? "") : null) : null);
        const instructionsText =
          (instructions ? readString(instructions["Text"]) : null) ??
          (instructions ? (readString(instructions["Html"]) ? stripHtml(readString(instructions["Html"]) ?? "") : null) : null);

        const openUrl = `${new URL(user.institutionUrl).origin}/d2l/lms/quizzing/quizzing.d2l?ou=${encodeURIComponent(
          orgUnitId
        )}&qi=${encodeURIComponent(quizId)}`;

        const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trim()}…` : value);

        const prefs = readClientPrefs(request);
        const dueLocal = formatIsoInClientPrefs(dueAt, prefs);
        const startLocal = formatIsoInClientPrefs(startAt, prefs);
        const endLocal = formatIsoInClientPrefs(endAt, prefs);

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
          `Availability (iso): ${startAt ?? "unknown"} -> ${endAt ?? "unknown"}`,
          `Open link: ${openUrl}`,
          "",
          "Description:",
          descriptionText ? clip(descriptionText, 2500) : "(no description text)",
          "",
          "Instructions:",
          instructionsText ? clip(instructionsText, 2500) : "(no instructions text)"
        ];

        const payload = await callGeminiForBrief({
          apiKey,
          model,
          contextText: contextParts.join("\n")
        });

        await upsertAiBrief({
          userId: user.id,
          targetType: "quiz",
          targetKey: `${orgUnitId}:${quizId}`,
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

export default quizzesOverviewRoute;
