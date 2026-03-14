import type { FastifyPluginAsync } from "fastify";

import { z } from "zod";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const targetTypeSchema = z.enum([
  "dropbox",
  "content_topic",
  "quiz",
  "calendar_event",
  "work_plan_optimizer"
]);

const putBodySchema = z.object({
  targetType: targetTypeSchema,
  targetKey: z.string().trim().min(1),
  checkedIds: z.array(z.string().trim().min(1)).optional(),
  locationText: z.string().trim().max(200).nullable().optional(),
  notesText: z.string().trim().max(20_000).nullable().optional()
});

const itemsStateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/items/state",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const query = request.query as { targetType?: string; targetKey?: string };
      const parsedType = targetTypeSchema.safeParse((query.targetType ?? "").trim());
      const targetKey = (query.targetKey ?? "").trim();

      if (!parsedType.success || !targetKey) {
        throw new AppError(400, "invalid parameters", "invalid_params");
      }

      const row = await prisma.itemState.findUnique({
        where: {
          userId_targetType_targetKey: {
            userId: request.auth.user.id,
            targetType: parsedType.data,
            targetKey
          }
        }
      });

      if (!row) {
        throw new AppError(404, "state not found", "state_not_found");
      }

      const checkedIds = Array.isArray(row.checkedIds) ? row.checkedIds : [];

      return {
        targetType: row.targetType,
        targetKey: row.targetKey,
        checkedIds,
        locationText: row.locationText ?? null,
        notesText: row.notesText ?? null,
        updatedAt: row.updatedAt.toISOString()
      };
    }
  );

  fastify.put(
    "/items/state",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const body = putBodySchema.parse(request.body);

      const userId = request.auth.user.id;

      const row = await prisma.itemState.upsert({
        where: {
          userId_targetType_targetKey: {
            userId,
            targetType: body.targetType,
            targetKey: body.targetKey
          }
        },
        create: {
          userId,
          targetType: body.targetType,
          targetKey: body.targetKey,
          checkedIds: body.checkedIds ?? [],
          locationText: body.locationText ?? null,
          notesText: body.notesText ?? null
        },
        update: {
          ...(body.checkedIds ? { checkedIds: body.checkedIds } : {}),
          ...(body.locationText !== undefined ? { locationText: body.locationText } : {}),
          ...(body.notesText !== undefined ? { notesText: body.notesText } : {})
        }
      });

      const checkedIds = Array.isArray(row.checkedIds) ? row.checkedIds : [];

      return {
        targetType: row.targetType,
        targetKey: row.targetKey,
        checkedIds,
        locationText: row.locationText ?? null,
        notesText: row.notesText ?? null,
        updatedAt: row.updatedAt.toISOString()
      };
    }
  );
};

export default itemsStateRoute;
