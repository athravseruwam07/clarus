import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { buildPlaceholderResponse } from "../../lib/placeholder.js";
import { AppError } from "../../lib/errors.js";
import { getWorkPlanContext } from "../../lib/workPlanContext.js";
import { optimizeStudentWorkPlan } from "../../lib/workPlanOptimizer.js";

const workItemTypeEnum = z.enum([
  "assignment",
  "quiz",
  "test",
  "discussion",
  "lab",
  "project",
  "reading",
  "presentation",
  "other"
]);

const dueAtSchema = z
  .string()
  .trim()
  .min(1, "dueAt is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "dueAt must be a valid ISO date or datetime");

const workItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  type: workItemTypeEnum,
  dueAt: dueAtSchema,
  estimatedMinutes: z.number().int().positive().max(24 * 60),
  complexityScore: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  priorityScore: z.number().min(0).max(100),
  gradeWeight: z.number().min(0).max(100)
});

const optimizeWorkPlanSchema = z.object({
  availability: z
    .object({
      timezone: z.string().trim().min(1).default("local"),
      weekdayMinutes: z.number().int().min(0).max(24 * 60).default(180),
      weekendMinutes: z.number().int().min(0).max(24 * 60).default(240),
      overrides: z
        .object({
          sunday: z.number().int().min(0).max(24 * 60).optional(),
          monday: z.number().int().min(0).max(24 * 60).optional(),
          tuesday: z.number().int().min(0).max(24 * 60).optional(),
          wednesday: z.number().int().min(0).max(24 * 60).optional(),
          thursday: z.number().int().min(0).max(24 * 60).optional(),
          friday: z.number().int().min(0).max(24 * 60).optional(),
          saturday: z.number().int().min(0).max(24 * 60).optional()
        })
        .default({})
    })
    .default({}),
  pace: z
    .object({
      productivityProfile: z.enum(["slow", "steady", "fast"]).default("steady"),
      focusMinutesPerSession: z.number().int().min(25).max(120).default(50),
      breakMinutes: z.number().int().min(0).max(60).default(10)
    })
    .default({}),
  priorities: z
    .object({
      preferHighRisk: z.boolean().default(true),
      preferHighWeight: z.boolean().default(true),
      preferNearDeadline: z.boolean().default(true)
    })
    .default({}),
  behavior: z
    .object({
      sessionsSkippedLast7d: z.number().int().min(0).max(50).default(0),
      recentSnoozeRate: z.number().min(0).max(1).default(0.2),
      avgCompletionDriftPct: z.number().min(-30).max(150).default(10),
      preferredTimeOfDay: z.enum(["morning", "afternoon", "evening"]).default("evening")
    })
    .default({}),
  recompute: z
    .object({
      trigger: z.enum(["initial", "session_skipped", "workload_changed"]).default("initial"),
      workloadChangeNote: z.string().trim().default(""),
      newAssessmentsAdded: z.number().int().min(0).max(50).default(0)
    })
    .default({}),
  workItems: z.array(workItemSchema).min(1, "at least one work item is required")
});

const member3OptimizationRoutes: FastifyPluginAsync = async (fastify) => {
  const optimizeWorkPlanHandler = async (request: { body: unknown }) => {
    const parsed = optimizeWorkPlanSchema.parse(request.body);
    return optimizeStudentWorkPlan(parsed);
  };

  fastify.get(
    "/reminders/adaptive",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "smart_reminders_adaptive",
        lane: "member-3-optimization-experience",
        nextAction:
          "Return adaptive reminder schedule that shifts by behavior, workload spikes, and estimated completion variance."
      });
    }
  );

  fastify.post(
    "/reminders/action",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "smart_reminders_action",
        lane: "member-3-optimization-experience",
        nextAction:
          "Persist reminder actions (mark done, snooze, start now, generate plan) to train reminder adaptation policy."
      });
    }
  );

  fastify.get(
    "/performance/tracker",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "submission_grade_tracker",
        lane: "member-3-optimization-experience",
        nextAction:
          "Return submission states, grade snapshot, what-if estimator output, and projected risk-to-grade trajectory."
      });
    }
  );

  fastify.post(
    "/study-plan/optimize",
    {
      preHandler: fastify.requireAuth
    },
    optimizeWorkPlanHandler
  );

  fastify.post(
    "/work-plan/optimize",
    {
      preHandler: fastify.requireAuth
    },
    optimizeWorkPlanHandler
  );

  fastify.get(
    "/work-plan/context",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const query = request.query as { refresh?: string | boolean | number | null | undefined };
      const refreshRaw = query?.refresh;
      const forceRefresh =
        refreshRaw === true ||
        refreshRaw === "true" ||
        refreshRaw === "1" ||
        refreshRaw === 1;

      return getWorkPlanContext(request.auth.user, { forceRefresh });
    }
  );

  fastify.get(
    "/prioritization/top-task",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const context = await getWorkPlanContext(request.auth.user);
      return {
        generatedAt: context.generatedAt,
        topTask: context.highestLeverageTask
      };
    }
  );

  fastify.post(
    "/copilot/respond",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      return buildPlaceholderResponse({
        request,
        feature: "conversational_copilot_mode",
        lane: "member-3-optimization-experience",
        nextAction:
          "Orchestrate priority, risk, effort, and content-locator outputs into grounded conversational action plans."
      });
    }
  );
};

export default member3OptimizationRoutes;
