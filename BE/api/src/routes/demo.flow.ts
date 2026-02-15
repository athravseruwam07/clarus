import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  type DemoAssignmentIntelligence,
  type DemoDashboardData,
  getDemoAssignmentIntelligence,
  getDemoCopilotResponse,
  getDemoDashboardData,
  getDemoInsightsData,
  startDemoStudySession
} from "../lib/demoFlow.js";
import { AppError, isAppError } from "../lib/errors.js";
import {
  getWorkPlanContext,
  type WorkPlanContextItem,
  type WorkPlanContextResponse
} from "../lib/workPlanContext.js";

const startSessionSchema = z.object({
  assignmentId: z.string().trim().min(1),
  plannedMinutes: z.number().int().positive().max(360).default(60)
});

const copilotPromptSchema = z.object({
  message: z.string().trim().min(1, "message is required")
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function assessmentTypeForDashboard(
  type: WorkPlanContextItem["type"]
): "assignment" | "quiz" | "discussion" | "lab" | "project" {
  if (type === "quiz" || type === "discussion" || type === "lab" || type === "project") {
    return type;
  }

  return "assignment";
}

function categoryForChecklist(text: string): "submission" | "rubric" | "format" | "citation" | "hidden" {
  const normalized = text.toLowerCase();
  if (normalized.includes("apa") || normalized.includes("citation") || normalized.includes("source")) {
    return "citation";
  }
  if (normalized.includes("hidden") || normalized.includes("requirement")) {
    return "hidden";
  }
  if (normalized.includes("format") || normalized.includes("file")) {
    return "format";
  }
  if (normalized.includes("rubric")) {
    return "rubric";
  }

  return "submission";
}

function recommendedStartDate(item: WorkPlanContextItem): string {
  const due = new Date(item.dueAt);
  const leadDays = item.riskScore >= 70 ? 4 : item.riskScore >= 55 ? 3 : 2;
  due.setDate(due.getDate() - leadDays);
  return due.toISOString();
}

function buildRiskDrivers(item: WorkPlanContextItem): string[] {
  const drivers: string[] = [];
  if (item.priorityBreakdown.deadlineProximity >= 14) {
    drivers.push("Due date proximity is elevated for this item.");
  }
  if (item.priorityBreakdown.risk >= 12) {
    drivers.push("Risk model flags a higher probability of delay without early progress.");
  }
  if (item.priorityBreakdown.gradeWeight >= 6) {
    drivers.push("Grade impact is meaningful relative to other current tasks.");
  }
  if (item.priorityBreakdown.complexity >= 8) {
    drivers.push("Complexity and deliverable load require multi-session execution.");
  }
  if (item.recentlyChanged) {
    drivers.push("Recently changed instructions increase review overhead.");
  }

  if (drivers.length === 0) {
    drivers.push("Weighted ranking still places this as a relevant near-term task.");
  }

  return drivers;
}

function buildSessionPlan(item: WorkPlanContextItem): DemoAssignmentIntelligence["sessionPlan"] {
  const total = Math.max(45, item.estimatedMinutes);
  const phaseLabels =
    item.type === "quiz"
      ? ["Review concepts", "Timed practice", "Error correction"]
      : ["Scope + outline", "Draft core work", "Revise + finalize"];

  const first = Math.max(25, Math.round(total * 0.35));
  const second = Math.max(25, Math.round(total * 0.4));
  const third = Math.max(20, total - first - second);
  const durations = [first, second, third];

  return phaseLabels.map((label, index) => ({
    label: `Session ${index + 1}`,
    durationMinutes: durations[index] ?? 30,
    objective:
      index === 0
        ? item.checklistTasks[0]?.text ?? "Define scope and collect required resources."
        : index === 1
          ? item.checklistTasks[1]?.text ?? "Build the main deliverable against rubric requirements."
          : item.checklistTasks[2]?.text ?? "Finalize quality checks and submission readiness."
  }));
}

function toAssignmentIntelligenceFromContext(item: WorkPlanContextItem): DemoAssignmentIntelligence {
  const nextStep =
    item.checklistTasks[0]?.text ??
    (item.contentLocator[0]
      ? `Start with ${item.contentLocator[0].module} -> ${item.contentLocator[0].lecture}.`
      : "Start with the highest-impact requirement first.");

  return {
    assignmentId: item.id,
    title: item.title,
    courseName: item.courseName,
    dueAt: item.dueAt,
    complexityScore: round2(item.complexityScore),
    effortHours: round2(item.estimatedMinutes / 60),
    riskScore: round2(item.riskScore),
    riskDrivers: buildRiskDrivers(item),
    recommendedStartDate: recommendedStartDate(item),
    highestLeverageNextStep: nextStep,
    checklist: item.checklistTasks.map((task) => ({
      id: task.id,
      text: task.text,
      category: categoryForChecklist(task.text),
      completed: false
    })),
    contentLocator: item.contentLocator.slice(0, 4).map((resource, index) => ({
      priority: index + 1,
      module: resource.module,
      lecture: resource.lecture,
      resource: resource.resource,
      section: resource.section,
      whyRelevant: resource.whyRelevant,
      confidence: resource.confidence
    })),
    sessionPlan: buildSessionPlan(item)
  };
}

function toDashboardFromContext(context: WorkPlanContextResponse): DemoDashboardData {
  const ranked = context.workItems.slice().sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10);
  const top = ranked[0];

  if (!top) {
    return getDemoDashboardData();
  }

  const next7DaysMs = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const nextWeekItems = ranked.filter((item) => new Date(item.dueAt).getTime() <= next7DaysMs);
  const nextWeekHours = round2(nextWeekItems.reduce((sum, item) => sum + item.estimatedMinutes, 0) / 60);
  const heavyWeek = nextWeekHours >= 10 || nextWeekItems.length >= 4;

  return {
    highestLeverageTask: {
      assignmentId: top.id,
      title: top.title,
      reason:
        context.highestLeverageTask?.reason ??
        "Ranked highest by deadline proximity, risk, grade impact, complexity, effort, and knowledge-gap impact.",
      riskScore: round2(top.riskScore),
      effortHours: round2(top.estimatedMinutes / 60)
    },
    riskAlert: {
      headline:
        top.riskScore >= 70
          ? "High risk item detected in active workload"
          : "Moderate risk cluster detected this week",
      explanation:
        top.riskScore >= 70
          ? `${top.title} has elevated delay risk and should be front-loaded.`
          : "Upcoming items have overlapping deadlines and need structured sequencing.",
      mitigation:
        top.checklistTasks[0]?.text ??
        "Start the top leverage task now and schedule a follow-up block within 24 hours."
    },
    workloadPreview: {
      heavyWeekDetected: heavyWeek,
      weekLabel: "Next 7 days",
      estimatedHours: nextWeekHours,
      recommendation: heavyWeek
        ? "Heavy week detected. Front-load high-risk deliverables and split deep work across multiple sessions."
        : "Workload is manageable. Keep daily progress blocks to preserve buffer before deadlines."
    },
    timeline: ranked.map((item) => ({
      assignmentId: item.id,
      title: item.title,
      courseName: item.courseName,
      assessmentType: assessmentTypeForDashboard(item.type),
      dueAt: item.dueAt,
      priorityScore: round2(item.priorityScore),
      riskScore: round2(item.riskScore),
      effortHours: round2(item.estimatedMinutes / 60),
      recommendedStartDate: recommendedStartDate(item),
      recentlyChanged: item.recentlyChanged
    }))
  };
}

const demoFlowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/demo/dashboard",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      try {
        const context = await getWorkPlanContext(request.auth.user);
        return toDashboardFromContext(context);
      } catch (error) {
        if (
          isAppError(error) &&
          (error.code === "session_expired" || error.code === "not_connected" || error.code === "unauthorized")
        ) {
          return getDemoDashboardData();
        }

        throw error;
      }
    }
  );

  fastify.get(
    "/demo/assignments/:assignmentId",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { assignmentId?: string };
      const assignmentId = params.assignmentId ?? "";

      try {
        return getDemoAssignmentIntelligence(assignmentId);
      } catch (error) {
        if (!(isAppError(error) && error.code === "assignment_not_found")) {
          throw error;
        }
      }

      const context = await getWorkPlanContext(request.auth.user);
      const liveItem = context.workItems.find((item) => item.id === assignmentId);

      if (!liveItem) {
        throw new AppError(404, "assignment intelligence not found", "assignment_not_found");
      }

      return toAssignmentIntelligenceFromContext(liveItem);
    }
  );

  fastify.post(
    "/demo/sessions/start",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      const body = startSessionSchema.parse(request.body);
      return startDemoStudySession({
        assignmentId: body.assignmentId,
        plannedMinutes: body.plannedMinutes,
        startedAt: new Date().toISOString()
      });
    }
  );

  fastify.get(
    "/demo/insights",
    {
      preHandler: fastify.requireAuth
    },
    async () => {
      return getDemoInsightsData();
    }
  );

  fastify.post(
    "/demo/copilot",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      const body = copilotPromptSchema.parse(request.body);
      return getDemoCopilotResponse(body.message);
    }
  );
};

export default demoFlowRoutes;
