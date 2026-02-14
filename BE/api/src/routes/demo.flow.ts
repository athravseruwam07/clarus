import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  getDemoAssignmentIntelligence,
  getDemoCopilotResponse,
  getDemoDashboardData,
  getDemoInsightsData,
  startDemoStudySession
} from "../lib/demoFlow.js";

const startSessionSchema = z.object({
  assignmentId: z.string().trim().min(1),
  plannedMinutes: z.number().int().positive().max(360).default(60)
});

const copilotPromptSchema = z.object({
  message: z.string().trim().min(1, "message is required")
});

const demoFlowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/demo/dashboard",
    {
      preHandler: fastify.requireAuth
    },
    async () => {
      return getDemoDashboardData();
    }
  );

  fastify.get(
    "/demo/assignments/:assignmentId",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      const params = request.params as { assignmentId?: string };
      const assignmentId = params.assignmentId ?? "";
      return getDemoAssignmentIntelligence(assignmentId);
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
