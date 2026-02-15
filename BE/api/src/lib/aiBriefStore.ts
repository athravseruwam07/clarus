import { Prisma } from "@prisma/client";

import type { AiBrief } from "./aiBrief.js";

import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

export type AiBriefTargetType = "dropbox" | "content_topic" | "quiz" | "calendar_event";

export async function getAiBrief(params: {
  userId: string;
  targetType: AiBriefTargetType;
  targetKey: string;
}): Promise<AiBrief | null> {
  let row: { briefJson: unknown } | null = null;

  try {
    row = await prisma.aiBrief.findUnique({
      where: {
        userId_targetType_targetKey: {
          userId: params.userId,
          targetType: params.targetType,
          targetKey: params.targetKey
        }
      },
      select: {
        briefJson: true
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      throw new AppError(
        500,
        "database schema is out of date. run prisma db push and restart the server.",
        "db_schema_out_of_date"
      );
    }

    throw error;
  }

  if (!row) {
    return null;
  }

  return row.briefJson as AiBrief;
}

export async function upsertAiBrief(params: {
  userId: string;
  targetType: AiBriefTargetType;
  targetKey: string;
  provider: string;
  model: string;
  brief: AiBrief;
}): Promise<void> {
  try {
    await prisma.aiBrief.upsert({
      where: {
        userId_targetType_targetKey: {
          userId: params.userId,
          targetType: params.targetType,
          targetKey: params.targetKey
        }
      },
      create: {
        userId: params.userId,
        targetType: params.targetType,
        targetKey: params.targetKey,
        provider: params.provider,
        model: params.model,
        schemaVer: 1,
        briefJson: params.brief,
        generatedAt: new Date()
      },
      update: {
        provider: params.provider,
        model: params.model,
        schemaVer: 1,
        briefJson: params.brief,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      throw new AppError(
        500,
        "database schema is out of date. run prisma db push and restart the server.",
        "db_schema_out_of_date"
      );
    }

    throw error;
  }
}
