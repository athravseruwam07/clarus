import type { FastifyPluginAsync } from "fastify";

import { AppError } from "../../lib/errors.js";
import { buildPlaceholderResponse } from "../../lib/placeholder.js";
import { prisma } from "../../lib/prisma.js";

const CALENDAR_SYNC_STALE_MS = 12 * 60 * 60 * 1000;

function parseCsv(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseIsoDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

const member1FoundationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/sync/full",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "auto_course_sync",
        lane: "member-1-foundation-modeling",
        nextAction:
          "Implement full-scope D2L sync (courses, modules, assignments, discussions, quizzes/tests, announcements, files, and grade items)."
      });
    }
  );

  fastify.get(
    "/sync/status",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "auto_course_sync_status",
        lane: "member-1-foundation-modeling",
        nextAction: "Return most recent sync health, item counts, and error diagnostics for observability."
      });
    }
  );

  fastify.get(
    "/timeline/intelligence",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const query = request.query as {
        from?: string;
        to?: string;
        orgUnitId?: string;
        include?: string;
        sources?: string;
      };
      const from = parseIsoDateOrNull(query.from);
      const to = parseIsoDateOrNull(query.to);

      const now = new Date();
      const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      const rangeFrom = from ?? defaultFrom;
      const rangeTo = to ?? defaultTo;

      if (rangeFrom.getTime() > rangeTo.getTime()) {
        throw new AppError(400, "`from` must be before `to`", "invalid_date_range");
      }

      const lastSync = await prisma.syncLog.findFirst({
        where: {
          userId: request.auth.user.id,
          syncType: "calendar",
          status: {
            in: ["success", "partial"]
          }
        },
        orderBy: {
          syncedAt: "desc"
        }
      });

      const needsSync =
        !lastSync || Date.now() - lastSync.syncedAt.getTime() > CALENDAR_SYNC_STALE_MS;

      const orgUnitId = typeof query.orgUnitId === "string" && query.orgUnitId.trim().length > 0
        ? query.orgUnitId.trim()
        : null;

      const includeKinds = (() => {
        const parsed = parseCsv(query.include);
        if (parsed.length === 0) {
          return ["due", "event"];
        }

        const allowed = new Set(["start", "due", "end", "event"]);
        const filtered = parsed.filter((kind) => allowed.has(kind));
        return filtered.length > 0 ? filtered : ["due", "event"];
      })();

      const sourceTypes = (() => {
        const parsed = parseCsv(query.sources);
        return parsed.length > 0 ? parsed : null;
      })();

      const events = await prisma.timelineEvent.findMany({
        where: {
          userId: request.auth.user.id,
          startAt: {
            gte: rangeFrom,
            lte: rangeTo
          },
          ...(orgUnitId ? { brightspaceOrgUnitId: orgUnitId } : {})
          ,
          dateKind: {
            in: includeKinds
          },
          ...(sourceTypes ? { sourceType: { in: sourceTypes } } : {})
        },
        include: {
          course: {
            select: {
              courseName: true,
              courseCode: true
            }
          }
        },
        orderBy: {
          startAt: "asc"
        }
      });

      return {
        lastSyncedAt: lastSync?.syncedAt.toISOString() ?? null,
        needsSync,
        events: events.map((event) => ({
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
        }))
      };
    }
  );

  fastify.get(
    "/changes/impact",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "deadline_change_detector_impact_intelligence",
        lane: "member-1-foundation-modeling",
        nextAction:
          "Detect LMS deltas and report before/after diff, impact severity, and downstream plan changes."
      });
    }
  );

  fastify.get(
    "/workload/forecast",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "workload_radar_forecast",
        lane: "member-1-foundation-modeling",
        nextAction:
          "Generate week-level workload forecast using assessment density, rubric complexity, and effort inputs."
      });
    }
  );

  fastify.get(
    "/risk/predict",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "academic_risk_prediction_engine",
        lane: "member-1-foundation-modeling",
        nextAction:
          "Return risk-to-miss and risk-to-underperform scores with explainable drivers and mitigation recommendations."
      });
    }
  );

  fastify.post(
    "/effort/estimate",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "ai_effort_estimation_engine",
        lane: "member-1-foundation-modeling",
        nextAction:
          "Estimate hours, buffer, and recommended start date from rubric structure, deliverables, and behavior-adjusted pace."
      });
    }
  );
};

export default member1FoundationRoutes;
