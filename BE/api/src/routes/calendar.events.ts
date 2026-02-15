import type { FastifyPluginAsync } from "fastify";

import { callGeminiForBrief } from "../lib/aiBrief.js";
import { getAiBrief, upsertAiBrief } from "../lib/aiBriefStore.js";
import { formatIsoInClientPrefs, readClientPrefs } from "../lib/clientPrefs.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const calendarEventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/calendar/events/:eventId",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { eventId?: string };
      const eventId = (params.eventId ?? "").trim();
      if (!eventId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const event = await prisma.timelineEvent.findUnique({
        where: {
          userId_sourceType_sourceId_dateKind: {
            userId: request.auth.user.id,
            sourceType: "calendar",
            sourceId: eventId,
            dateKind: "event"
          }
        },
        include: {
          course: {
            select: {
              courseName: true,
              courseCode: true
            }
          }
        }
      });

      if (!event) {
        throw new AppError(404, "event not found", "calendar_event_not_found");
      }

      return {
        id: `${event.sourceType}:${event.sourceId}:${event.dateKind}`,
        sourceId: event.sourceId,
        orgUnitId: event.brightspaceOrgUnitId,
        courseName: event.course?.courseName ?? null,
        courseCode: event.course?.courseCode ?? null,
        title: event.title,
        description: event.description ?? null,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt ? event.endAt.toISOString() : null,
        isAllDay: event.isAllDay,
        sourceType: event.sourceType,
        dateKind: event.dateKind,
        associatedEntityType: event.associatedEntityType ?? null,
        associatedEntityId: event.associatedEntityId ?? null,
        viewUrl: event.viewUrl ?? null
      };
    }
  );

  fastify.get(
    "/calendar/events/:eventId/ai/brief",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { eventId?: string };
      const eventId = (params.eventId ?? "").trim();
      if (!eventId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const cached = await getAiBrief({
        userId: request.auth.user.id,
        targetType: "calendar_event",
        targetKey: eventId
      });

      if (!cached) {
        throw new AppError(404, "brief not found", "brief_not_found");
      }

      return cached;
    }
  );

  fastify.post(
    "/calendar/events/:eventId/ai/brief",
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

      const params = request.params as { eventId?: string };
      const eventId = (params.eventId ?? "").trim();
      if (!eventId) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const event = await prisma.timelineEvent.findUnique({
        where: {
          userId_sourceType_sourceId_dateKind: {
            userId: request.auth.user.id,
            sourceType: "calendar",
            sourceId: eventId,
            dateKind: "event"
          }
        },
        include: {
          course: {
            select: {
              courseName: true,
              courseCode: true
            }
          }
        }
      });

      if (!event) {
        throw new AppError(404, "event not found", "calendar_event_not_found");
      }

      const courseLabel = event.course
        ? `${event.course.courseCode ? `${event.course.courseCode} · ` : ""}${event.course.courseName}`.trim()
        : "unknown";

      const prefs = readClientPrefs(request);
      const startIso = event.startAt.toISOString();
      const startLocal = formatIsoInClientPrefs(startIso, prefs);

      const contextParts: string[] = [
        "Important: Use the provided LOCAL time strings as-is; do not convert between time zones.",
        `Client timezone: ${prefs.timeZone ?? "unknown"}`,
        `Client locale: ${prefs.locale ?? "unknown"}`,
        `When (local): ${startLocal ?? "unknown"}`,
        `When (iso): ${startIso}`,
        "",
        `Title: ${event.title}`,
        `Course: ${courseLabel || "unknown"}`,
        `All day: ${event.isAllDay ? "yes" : "no"}`,
        `Associated type: ${event.associatedEntityType ?? "unknown"}`,
        `Associated id: ${event.associatedEntityId ?? "unknown"}`,
        `Open link: ${event.viewUrl ?? "unknown"}`,
        "",
        "Description:",
        event.description ? event.description : "(no description available)"
      ];

      const payload = await callGeminiForBrief({
        apiKey,
        model,
        contextText: contextParts.join("\n")
      });

      await upsertAiBrief({
        userId: request.auth.user.id,
        targetType: "calendar_event",
        targetKey: eventId,
        provider: "gemini",
        model,
        brief: payload
      });

      return payload;
    }
  );
};

export default calendarEventsRoute;
