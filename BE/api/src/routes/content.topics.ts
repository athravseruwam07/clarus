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

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

async function fetchContentTopic(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  orgUnitId: string;
  topicId: string;
}): Promise<JsonRecord> {
  const leVersion = await getWorkingLeVersion({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    probeApiPath: (version) => `/d2l/api/le/${version}/${input.orgUnitId}/content/topics/${input.topicId}`
  });

  const response = await connectorRequest<unknown>({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    apiPath: `/d2l/api/le/${leVersion}/${input.orgUnitId}/content/topics/${input.topicId}`
  });

  const topic = asRecord(response.data);
  if (!topic) {
    throw new AppError(502, "content topic api returned unexpected payload", "content_topic_invalid_payload");
  }

  return topic;
}

const contentTopicsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/content/topics/:orgUnitId/:topicId",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { orgUnitId?: string; topicId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const topicId = (params.topicId ?? "").trim();

      if (!orgUnitId || !topicId) {
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
      const topic = await fetchContentTopic({
        instanceUrl: user.institutionUrl,
        storageState,
        orgUnitId,
        topicId
      });

      const description = asRecord(topic["Description"]);
      const descriptionText =
        (description ? readString(description["Text"]) : null) ??
        (description ? (readString(description["Html"]) ? stripHtml(readString(description["Html"]) ?? "") : null) : null);
      const descriptionHtml = description ? readString(description["Html"]) : null;

      const relativeUrl = readString(topic["Url"]);
      const openUrl = relativeUrl ? new URL(relativeUrl, user.institutionUrl).toString() : null;

      return {
        orgUnitId,
        topicId,
        courseName: course.courseName,
        courseCode: course.courseCode ?? null,
        title: readString(topic["Title"]) ?? "untitled content",
        dueAt: toIsoOrNull(topic["DueDate"]),
        startAt: toIsoOrNull(topic["StartDate"]),
        endAt: toIsoOrNull(topic["EndDate"]),
        isHidden: topic["IsHidden"] === true,
        isLocked: topic["IsLocked"] === true,
        isBroken: topic["IsBroken"] === true,
        openAsExternalResource: topic["OpenAsExternalResource"] === true,
        topicType: readNumber(topic["TopicType"]),
        activityType: readNumber(topic["ActivityType"]),
        toolId: readNumber(topic["ToolId"]),
        toolItemId: readNumber(topic["ToolItemId"]),
        gradeItemId: readNumber(topic["GradeItemId"]),
        descriptionText,
        descriptionHtml: descriptionHtml && descriptionHtml.trim().length > 0 ? descriptionHtml : null,
        openUrl
      };
    }
  );

  fastify.get(
    "/content/topics/:orgUnitId/:topicId/ai/brief",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { orgUnitId?: string; topicId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const topicId = (params.topicId ?? "").trim();

      if (!orgUnitId || !topicId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const cached = await getAiBrief({
        userId: request.auth.user.id,
        targetType: "content_topic",
        targetKey: `${orgUnitId}:${topicId}`
      });

      if (!cached) {
        throw new AppError(404, "brief not found", "brief_not_found");
      }

      return cached;
    }
  );

  fastify.post(
    "/content/topics/:orgUnitId/:topicId/ai/brief",
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

      const params = request.params as { orgUnitId?: string; topicId?: string };
      const orgUnitId = (params.orgUnitId ?? "").trim();
      const topicId = (params.topicId ?? "").trim();

      if (!orgUnitId || !topicId) {
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
        const topic = await fetchContentTopic({
          instanceUrl: user.institutionUrl,
          storageState,
          orgUnitId,
          topicId
        });

        const description = asRecord(topic["Description"]);
        const descriptionText =
          (description ? readString(description["Text"]) : null) ??
          (description ? (readString(description["Html"]) ? stripHtml(readString(description["Html"]) ?? "") : null) : null);

        const title = readString(topic["Title"]) ?? "content topic";
        const dueAt = toIsoOrNull(topic["DueDate"]);
        const startAt = toIsoOrNull(topic["StartDate"]);
        const endAt = toIsoOrNull(topic["EndDate"]);

        const relativeUrl = readString(topic["Url"]);
        const openUrl = relativeUrl ? new URL(relativeUrl, user.institutionUrl).toString() : null;

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
          `Open link: ${openUrl ?? "unknown"}`,
          "",
          "Description / instructions:",
          descriptionText ? clip(descriptionText, 3500) : "(no description text provided for this content item)",
          "",
          "Notes:",
          "- This item is a Brightspace Content Topic. It may link out to an external tool (LTI) or another Brightspace tool.",
          "- If details are missing, instruct the student to open the link and add questionsToClarify."
        ];

        const payload = await callGeminiForBrief({
          apiKey,
          model,
          contextText: contextParts.join("\n")
        });

        await upsertAiBrief({
          userId: user.id,
          targetType: "content_topic",
          targetKey: `${orgUnitId}:${topicId}`,
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

export default contentTopicsRoute;
