import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { readClientPrefs } from "../lib/clientPrefs.js";
import {
  generateThreadTitle,
  MAX_COPILOT_MESSAGE_LENGTH,
  runCopilotTurn
} from "../lib/copilot.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

type CopilotMessageDto = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Array<{
    id: string;
    type: "course" | "timeline_event" | "ai_brief" | "item_state";
    label: string;
    href: string | null;
    internalPath: string | null;
  }>;
  actions: string[];
  followUps: string[];
  confidence: "high" | "medium" | "low" | null;
  model: string | null;
  createdAt: string;
};

const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  initialMessage: z.string().trim().min(1).max(MAX_COPILOT_MESSAGE_LENGTH).optional(),
  context: z
    .object({
      activeOrgUnitId: z.string().trim().min(1).max(100).optional(),
      activePage: z.string().trim().min(1).max(120).optional()
    })
    .optional()
});

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(MAX_COPILOT_MESSAGE_LENGTH),
  context: z
    .object({
      activeOrgUnitId: z.string().trim().min(1).max(100).optional(),
      activePage: z.string().trim().min(1).max(120).optional()
    })
    .optional()
});

const messagesQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

function copilotEnabled(): boolean {
  const raw = process.env.COPILOT_V1_ENABLED?.trim().toLowerCase();
  return raw !== "false";
}

function mapCitations(value: unknown): CopilotMessageDto["citations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const mapped: CopilotMessageDto["citations"] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const type = record.type;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!id || !label) {
      continue;
    }
    if (type !== "course" && type !== "timeline_event" && type !== "ai_brief" && type !== "item_state") {
      continue;
    }

    mapped.push({
      id,
      type,
      label,
      href: typeof record.href === "string" ? record.href : null,
      internalPath: typeof record.internalPath === "string" ? record.internalPath : null
    });
  }

  return mapped.slice(0, 12);
}

function mapMessageDto(message: {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  contextSnapshot: unknown;
  model: string | null;
  createdAt: Date;
}): CopilotMessageDto {
  const snapshot =
    typeof message.contextSnapshot === "object" &&
    message.contextSnapshot !== null &&
    !Array.isArray(message.contextSnapshot)
      ? (message.contextSnapshot as Record<string, unknown>)
      : {};

  const actions = Array.isArray(snapshot.actions)
    ? snapshot.actions
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 6)
    : [];
  const followUps = Array.isArray(snapshot.followUps)
    ? snapshot.followUps
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 5)
    : [];

  const confidence =
    snapshot.confidence === "high" || snapshot.confidence === "medium" || snapshot.confidence === "low"
      ? snapshot.confidence
      : null;

  const role: CopilotMessageDto["role"] =
    message.role === "assistant" || message.role === "system" ? message.role : "user";

  return {
    id: message.id,
    role,
    content: message.content,
    citations: mapCitations(message.citations),
    actions,
    followUps,
    confidence,
    model: message.model ?? null,
    createdAt: message.createdAt.toISOString()
  };
}

async function enforceRateLimit(userId: string): Promise<void> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.copilotMessage.count({
    where: {
      userId,
      role: "user",
      createdAt: {
        gte: windowStart
      }
    }
  });

  if (recentCount >= 30) {
    throw new AppError(429, "copilot request limit reached. try again in a bit.", "copilot_rate_limited");
  }
}

const copilotRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/copilot/threads",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }
      if (!copilotEnabled()) {
        throw new AppError(503, "copilot is currently disabled", "copilot_disabled");
      }

      const rows = await prisma.copilotThread.findMany({
        where: { userId: request.auth.user.id },
        orderBy: [{ lastMessageAt: "desc" }],
        take: 100,
        select: {
          id: true,
          title: true,
          lastMessageAt: true,
          _count: {
            select: { messages: true }
          },
          messages: {
            orderBy: [{ createdAt: "desc" }],
            take: 1,
            select: { content: true }
          }
        }
      });

      return {
        threads: rows.map((row) => ({
          id: row.id,
          title: row.title,
          lastMessageAt: row.lastMessageAt.toISOString(),
          messageCount: row._count.messages,
          preview: row.messages[0]?.content.slice(0, 160) ?? null
        }))
      };
    }
  );

  fastify.post(
    "/copilot/threads",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }
      if (!copilotEnabled()) {
        throw new AppError(503, "copilot is currently disabled", "copilot_disabled");
      }

      const body = createThreadSchema.parse(request.body ?? {});
      const now = new Date();
      const title = body.title ?? (body.initialMessage ? generateThreadTitle(body.initialMessage) : "New chat");

      const thread = await prisma.copilotThread.create({
        data: {
          userId: request.auth.user.id,
          title,
          lastMessageAt: now
        }
      });

      if (!body.initialMessage) {
        return {
          thread: {
            id: thread.id,
            title: thread.title,
            lastMessageAt: thread.lastMessageAt.toISOString(),
            messageCount: 0,
            preview: null
          },
          assistantMessage: null
        };
      }

      await enforceRateLimit(request.auth.user.id);

      await prisma.copilotMessage.create({
        data: {
          threadId: thread.id,
          userId: request.auth.user.id,
          role: "user",
          content: body.initialMessage,
          citations: Prisma.JsonNull,
          contextSnapshot: {
            source: "initial_message",
            activePage: body.context?.activePage ?? null
          } as Prisma.InputJsonValue
        }
      });

      const prefs = readClientPrefs(request);
      const turn = await runCopilotTurn({
        userId: request.auth.user.id,
        threadId: thread.id,
        message: body.initialMessage,
        activeOrgUnitId: body.context?.activeOrgUnitId ?? null,
        clientPrefs: prefs
      });

      const assistant = await prisma.copilotMessage.create({
        data: {
          threadId: thread.id,
          userId: request.auth.user.id,
          role: "assistant",
          content: turn.answer,
          citations: turn.citations as unknown as Prisma.InputJsonValue,
          contextSnapshot: turn.contextSnapshot as Prisma.InputJsonValue,
          model: turn.model,
          latencyMs: turn.latencyMs
        }
      });

      await prisma.copilotThread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: assistant.createdAt
        }
      });

      return {
        thread: {
          id: thread.id,
          title: thread.title,
          lastMessageAt: assistant.createdAt.toISOString(),
          messageCount: 2,
          preview: turn.answer.slice(0, 160)
        },
        assistantMessage: mapMessageDto({
          ...assistant,
          citations: assistant.citations,
          contextSnapshot: {
            ...(typeof assistant.contextSnapshot === "object" && assistant.contextSnapshot !== null
              ? (assistant.contextSnapshot as Record<string, unknown>)
              : {}),
            actions: turn.actions,
            followUps: turn.followUps,
            confidence: turn.confidence
          }
        })
      };
    }
  );

  fastify.get(
    "/copilot/threads/:threadId/messages",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }
      if (!copilotEnabled()) {
        throw new AppError(503, "copilot is currently disabled", "copilot_disabled");
      }

      const params = request.params as { threadId?: string };
      const threadId = (params.threadId ?? "").trim();
      if (!threadId) {
        throw new AppError(400, "invalid thread id", "invalid_params");
      }

      const query = messagesQuerySchema.parse(request.query ?? {});
      const thread = await prisma.copilotThread.findFirst({
        where: {
          id: threadId,
          userId: request.auth.user.id
        },
        select: { id: true }
      });

      if (!thread) {
        throw new AppError(404, "thread not found", "copilot_thread_not_found");
      }

      let where: Prisma.CopilotMessageWhereInput = {
        threadId,
        userId: request.auth.user.id
      };

      if (query.cursor) {
        const cursorRow = await prisma.copilotMessage.findFirst({
          where: {
            id: query.cursor,
            threadId,
            userId: request.auth.user.id
          },
          select: {
            id: true,
            createdAt: true
          }
        });

        if (!cursorRow) {
          throw new AppError(400, "invalid cursor", "invalid_cursor");
        }

        where = {
          threadId,
          userId: request.auth.user.id,
          OR: [
            {
              createdAt: {
                gt: cursorRow.createdAt
              }
            },
            {
              createdAt: cursorRow.createdAt,
              id: {
                gt: cursorRow.id
              }
            }
          ]
        };
      }

      const rows = await prisma.copilotMessage.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: query.limit
      });

      return {
        messages: rows.map((row) => mapMessageDto(row)),
        nextCursor: rows.length === query.limit ? rows[rows.length - 1]?.id ?? null : null
      };
    }
  );

  fastify.post(
    "/copilot/threads/:threadId/messages",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }
      if (!copilotEnabled()) {
        throw new AppError(503, "copilot is currently disabled", "copilot_disabled");
      }

      const params = request.params as { threadId?: string };
      const threadId = (params.threadId ?? "").trim();
      if (!threadId) {
        throw new AppError(400, "invalid thread id", "invalid_params");
      }

      const body = sendMessageSchema.parse(request.body ?? {});

      const thread = await prisma.copilotThread.findFirst({
        where: {
          id: threadId,
          userId: request.auth.user.id
        },
        select: {
          id: true,
          title: true,
          _count: {
            select: { messages: true }
          }
        }
      });
      if (!thread) {
        throw new AppError(404, "thread not found", "copilot_thread_not_found");
      }

      await enforceRateLimit(request.auth.user.id);

      const createdUserMessage = await prisma.copilotMessage.create({
        data: {
          threadId,
          userId: request.auth.user.id,
          role: "user",
          content: body.message,
          citations: Prisma.JsonNull,
          contextSnapshot: {
            activeOrgUnitId: body.context?.activeOrgUnitId ?? null,
            activePage: body.context?.activePage ?? null
          } as Prisma.InputJsonValue
        }
      });

      request.log.info(
        {
          userId: request.auth.user.id,
          threadId,
          requestChars: body.message.length
        },
        "copilot message received"
      );

      const prefs = readClientPrefs(request);
      const turn = await runCopilotTurn({
        userId: request.auth.user.id,
        threadId,
        message: body.message,
        activeOrgUnitId: body.context?.activeOrgUnitId ?? null,
        clientPrefs: prefs
      });

      request.log.info(
        {
          userId: request.auth.user.id,
          threadId,
          model: turn.model,
          latencyMs: turn.latencyMs,
          citations: turn.citations.length,
          confidence: turn.confidence
        },
        "copilot response generated"
      );

      const assistantMessage = await prisma.copilotMessage.create({
        data: {
          threadId,
          userId: request.auth.user.id,
          role: "assistant",
          content: turn.answer,
          citations: turn.citations as unknown as Prisma.InputJsonValue,
          contextSnapshot: {
            ...turn.contextSnapshot,
            actions: turn.actions,
            followUps: turn.followUps,
            confidence: turn.confidence
          } as Prisma.InputJsonValue,
          model: turn.model,
          latencyMs: turn.latencyMs
        }
      });

      const nextTitle =
        thread.title.trim().toLowerCase() === "new chat" && thread._count.messages <= 1
          ? generateThreadTitle(body.message)
          : thread.title;

      await prisma.copilotThread.update({
        where: { id: threadId },
        data: {
          title: nextTitle,
          lastMessageAt: assistantMessage.createdAt
        }
      });

      const assistantDto = mapMessageDto({
        ...assistantMessage,
        citations: assistantMessage.citations,
        contextSnapshot: {
          ...(typeof assistantMessage.contextSnapshot === "object" &&
          assistantMessage.contextSnapshot !== null &&
          !Array.isArray(assistantMessage.contextSnapshot)
            ? (assistantMessage.contextSnapshot as Record<string, unknown>)
            : {}),
          actions: turn.actions,
          followUps: turn.followUps,
          confidence: turn.confidence
        }
      });

      return {
        threadId,
        userMessageId: createdUserMessage.id,
        assistantMessage: assistantDto,
        actions: assistantDto.actions,
        citations: assistantDto.citations,
        followUps: assistantDto.followUps,
        confidence: assistantDto.confidence
      };
    }
  );

  fastify.delete(
    "/copilot/threads/:threadId",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }
      if (!copilotEnabled()) {
        throw new AppError(503, "copilot is currently disabled", "copilot_disabled");
      }

      const params = request.params as { threadId?: string };
      const threadId = (params.threadId ?? "").trim();
      if (!threadId) {
        throw new AppError(400, "invalid thread id", "invalid_params");
      }

      const thread = await prisma.copilotThread.findFirst({
        where: {
          id: threadId,
          userId: request.auth.user.id
        },
        select: { id: true }
      });
      if (!thread) {
        throw new AppError(404, "thread not found", "copilot_thread_not_found");
      }

      await prisma.copilotThread.delete({
        where: { id: thread.id }
      });

      return { success: true };
    }
  );
};

export default copilotRoute;
