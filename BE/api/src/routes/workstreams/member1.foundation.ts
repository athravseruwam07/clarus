import type { FastifyPluginAsync } from "fastify";

import { AppError } from "../../lib/errors.js";
import { buildPlaceholderResponse } from "../../lib/placeholder.js";
import { prisma } from "../../lib/prisma.js";
import { getCurrentMonday, buildForecast } from "../../lib/workloadForecast.js";
import type { ForecastAssessment } from "../../lib/workloadForecast.js";

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
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const monday = getCurrentMonday();
      const fourWeeksOut = new Date(monday);
      fourWeeksOut.setDate(monday.getDate() + 28);

      const events = await prisma.timelineEvent.findMany({
        where: {
          userId: request.auth.user.id,
          startAt: { gte: monday, lt: fourWeeksOut },
          // Some D2L tools expose deadline-like dates as EndDate rather than DueDate.
          // Include `end` so workload forecasting reflects real upcoming submissions.
          dateKind: { in: ["due", "event", "end"] }
        },
        include: {
          course: { select: { courseName: true, courseCode: true } }
        },
        orderBy: { startAt: "asc" }
      });

      // Build brief lookup keys based on how each source type stores its targetKey
      const briefLookups: { targetType: string; targetKey: string }[] = [];
      for (const e of events) {
        switch (e.sourceType) {
          case "dropbox_folder":
            briefLookups.push({ targetType: "dropbox", targetKey: `${e.brightspaceOrgUnitId}:${e.sourceId}` });
            break;
          case "content_topic":
            briefLookups.push({ targetType: "content_topic", targetKey: `${e.brightspaceOrgUnitId}:${e.sourceId}` });
            break;
          case "quiz":
            briefLookups.push({ targetType: "quiz", targetKey: `${e.brightspaceOrgUnitId}:${e.sourceId}` });
            break;
          case "calendar":
            briefLookups.push({ targetType: "calendar_event", targetKey: e.sourceId });
            break;
          default:
            break;
        }
      }

      // Batch-fetch AI briefs where available
      const briefs = briefLookups.length > 0
        ? await prisma.aiBrief.findMany({
            where: {
              userId: request.auth.user.id,
              OR: briefLookups.map((l) => ({ targetType: l.targetType, targetKey: l.targetKey }))
            }
          })
        : [];

      const briefMap = new Map(briefs.map((b) => [`${b.targetType}:${b.targetKey}`, b.briefJson]));

      // Helper: resolve the brief lookup key for an event
      function briefKeyFor(e: typeof events[number]): string | null {
        switch (e.sourceType) {
          case "dropbox_folder": return `dropbox:${e.brightspaceOrgUnitId}:${e.sourceId}`;
          case "content_topic": return `content_topic:${e.brightspaceOrgUnitId}:${e.sourceId}`;
          case "quiz": return `quiz:${e.brightspaceOrgUnitId}:${e.sourceId}`;
          case "calendar": return `calendar_event:${e.sourceId}`;
          default: return null;
        }
      }

      // Map sourceType → assessmentType
      function inferAssessmentType(e: typeof events[number]): ForecastAssessment["assessmentType"] {
        switch (e.sourceType) {
          case "dropbox_folder": return "assignment";
          case "quiz": return "quiz";
          case "content_topic": return "assignment";
          case "discussion_forum":
          case "discussion_topic": return "discussion";
          case "checklist": return "assignment";
          case "content_module": return "assignment";
          case "generic": return "assignment";
          case "calendar": {
            const t = e.title.toLowerCase();
            if (/\b(midterm|exam|final)\b/.test(t)) return "midterm";
            if (/\blab\b/.test(t)) return "lab";
            if (/\bquiz\b/.test(t)) return "quiz";
            if (/\bproject\b/.test(t)) return "project";
            if (/\bdiscussion\b/.test(t)) return "discussion";
            return "assignment";
          }
          default: return "assignment";
        }
      }

      // Default hour estimates by assessment type
      const DEFAULT_HOURS: Record<ForecastAssessment["assessmentType"], number> = {
        midterm: 5,
        assignment: 3,
        project: 4,
        quiz: 1.5,
        lab: 2,
        discussion: 1
      };

      // Estimate hours from AI brief checklist or fall back to defaults
      function estimateHours(briefJson: unknown, assessmentType: ForecastAssessment["assessmentType"]): number {
        if (briefJson && typeof briefJson === "object" && !Array.isArray(briefJson)) {
          const brief = briefJson as { checklist?: Array<{ estimatedMinutes?: number | null }> };
          if (Array.isArray(brief.checklist) && brief.checklist.length > 0) {
            const totalMinutes = brief.checklist.reduce(
              (sum, item) => sum + (item.estimatedMinutes ?? 0), 0
            );
            if (totalMinutes > 0) {
              return Math.round((totalMinutes / 60) * 10) / 10;
            }
          }
        }
        return DEFAULT_HOURS[assessmentType];
      }

      // Derive complexity from assessment type, override if brief has 2+ risk flags
      function deriveComplexity(assessmentType: ForecastAssessment["assessmentType"], briefJson: unknown): ForecastAssessment["complexity"] {
        let base: ForecastAssessment["complexity"];
        switch (assessmentType) {
          case "midterm":
          case "project":
            base = "high";
            break;
          case "discussion":
            base = "low";
            break;
          default:
            base = "medium";
        }

        if (briefJson && typeof briefJson === "object" && !Array.isArray(briefJson)) {
          const brief = briefJson as { riskFlags?: string[] };
          if (Array.isArray(brief.riskFlags) && brief.riskFlags.length >= 2) {
            base = "high";
          }
        }

        return base;
      }

      // Map events to ForecastAssessment[]
      const assessments: ForecastAssessment[] = events.map((e) => {
        const assessmentType = inferAssessmentType(e);
        const bKey = briefKeyFor(e);
        const briefJson = bKey ? briefMap.get(bKey) ?? null : null;
        const estimatedHours = estimateHours(briefJson, assessmentType);
        const complexity = deriveComplexity(assessmentType, briefJson);

        return {
          id: `${e.sourceType}:${e.sourceId}`,
          title: e.title,
          courseName: e.course?.courseName ?? "Unknown Course",
          courseCode: e.course?.courseCode ?? "",
          assessmentType,
          dueDate: e.startAt.toISOString(),
          estimatedHours,
          complexity,
          weight: 0,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          orgUnitId: e.brightspaceOrgUnitId,
          associatedEntityType: e.associatedEntityType ?? null,
          associatedEntityId: e.associatedEntityId ?? null,
          viewUrl: e.viewUrl ?? null
        };
      });

      return buildForecast(assessments);
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
