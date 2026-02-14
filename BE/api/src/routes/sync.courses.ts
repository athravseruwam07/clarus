import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { connectorRequest } from "../lib/connectorClient.js";
import { AppError, isAppError, safeErrorMessage } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";
import {
  extractEnrollmentItems,
  MY_ENROLLMENTS_API_PATH,
  toDateOrNull
} from "../lib/valence.js";

function isCourseOffering(item: { OrgUnit: { Type?: { Id: number; Code: string } | null } }): boolean {
  const type = item.OrgUnit.Type;
  if (!type) {
    return false;
  }

  if (type.Id === 3) {
    return true;
  }

  return type.Code.toLowerCase() === "course offering";
}

const syncCoursesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/sync/courses",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        throw new AppError(400, "connect to d2l before syncing courses", "not_connected");
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);

      try {
        const enrollmentResponse = await connectorRequest<unknown>({
          instanceUrl: user.institutionUrl,
          storageState,
          apiPath: MY_ENROLLMENTS_API_PATH
        });

        const enrollmentItems = extractEnrollmentItems(enrollmentResponse.data);
        const courseOfferingItems = enrollmentItems.filter((item) => isCourseOffering(item));
        const now = new Date();

        const courseIds = Array.from(
          new Set(courseOfferingItems.map((item) => item.OrgUnit.Id.toString()))
        );

        await prisma.$transaction(async (tx) => {
          await Promise.all(
            courseOfferingItems.map((item) =>
              tx.course.upsert({
                where: {
                  userId_brightspaceCourseId: {
                    userId: user.id,
                    brightspaceCourseId: item.OrgUnit.Id.toString()
                  }
                },
                update: {
                  courseName: item.OrgUnit.Name,
                  courseCode: item.OrgUnit.Code ?? null,
                  startDate: toDateOrNull(item.Access?.StartDate),
                  endDate: toDateOrNull(item.Access?.EndDate),
                  isActive: item.Access?.IsActive ?? true,
                  rawData: item as Prisma.InputJsonValue,
                  lastSyncedAt: now
                },
                create: {
                  userId: user.id,
                  brightspaceCourseId: item.OrgUnit.Id.toString(),
                  courseName: item.OrgUnit.Name,
                  courseCode: item.OrgUnit.Code ?? null,
                  startDate: toDateOrNull(item.Access?.StartDate),
                  endDate: toDateOrNull(item.Access?.EndDate),
                  isActive: item.Access?.IsActive ?? true,
                  rawData: item as Prisma.InputJsonValue,
                  lastSyncedAt: now
                }
              })
            )
          );

          // clean up any previously stored non-course enrollments (groups/orgs) and dropped courses.
          if (courseIds.length > 0) {
            await tx.course.deleteMany({
              where: {
                userId: user.id,
                brightspaceCourseId: {
                  notIn: courseIds
                }
              }
            });
          }
        });

        await prisma.syncLog.create({
          data: {
            userId: user.id,
            syncType: "full",
            status: "success",
            itemsSynced: courseOfferingItems.length
          }
        });

        return {
          success: true,
          coursesSynced: courseOfferingItems.length
        };
      } catch (error) {
        await prisma.syncLog
          .create({
            data: {
              userId: user.id,
              syncType: "full",
              status: "failed",
              itemsSynced: 0,
              errorMessage: safeErrorMessage(error)
            }
          })
          .catch(() => undefined);

        if (isAppError(error) && error.code === "session_expired") {
          throw new AppError(401, "session expired", "session_expired");
        }

        throw error;
      }
    }
  );

  fastify.get(
    "/sync/logs",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const logs = await prisma.syncLog.findMany({
        where: {
          userId: request.auth.user.id
        },
        orderBy: {
          syncedAt: "desc"
        },
        take: 10
      });

      return {
        logs
      };
    }
  );
};

export default syncCoursesRoute;
