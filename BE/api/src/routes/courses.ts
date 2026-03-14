import type { FastifyPluginAsync } from "fastify";

import { connectorAssetRequest } from "../lib/connectorClient.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readCourseAssetUrls(rawData: unknown): { imageUrl: string | null; homeUrl: string | null } {
  const root = asRecord(rawData);
  if (!root) {
    return { imageUrl: null, homeUrl: null };
  }

  const orgUnit = asRecord(root["OrgUnit"]);

  return {
    imageUrl: readString(orgUnit?.["ImageUrl"]) ?? readString(root["ImageUrl"]),
    homeUrl: readString(orgUnit?.["HomeUrl"]) ?? readString(root["HomeUrl"])
  };
}

function toAbsoluteUrl(url: string | null, baseUrl: string | null): string | null {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  if (url.startsWith("/")) {
    return `${normalizedBase}${url}`;
  }

  return `${normalizedBase}/${url.replace(/^\.?\//, "")}`;
}

function isHostSuffix(host: string, suffix: string): boolean {
  if (host === suffix) {
    return true;
  }

  return host.endsWith(`.${suffix}`);
}

function isAllowedAssetHost(assetUrl: string, institutionUrl: string): boolean {
  const assetHost = new URL(assetUrl).hostname.toLowerCase();
  const institutionHost = new URL(institutionUrl).hostname.toLowerCase();
  return isHostSuffix(assetHost, institutionHost) || isHostSuffix(institutionHost, assetHost);
}

const coursesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/courses/:courseId/image",
    {
      preHandler: fastify.requireAuth
    },
    async (request, reply) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const params = request.params as { courseId?: string };
      const courseId = typeof params.courseId === "string" ? params.courseId.trim() : "";
      if (!courseId) {
        throw new AppError(400, "course id is required", "invalid_course_id");
      }

      const course = await prisma.course.findFirst({
        where: {
          id: courseId,
          userId: request.auth.user.id
        },
        select: {
          rawData: true
        }
      });

      if (!course) {
        throw new AppError(404, "course not found", "course_not_found");
      }

      const institutionUrl = readString(request.auth.user.institutionUrl);
      if (!institutionUrl) {
        throw new AppError(400, "connect to d2l first", "not_connected");
      }

      const assets = readCourseAssetUrls(course.rawData);
      const imageUrl = toAbsoluteUrl(assets.imageUrl, institutionUrl);
      if (!imageUrl) {
        throw new AppError(404, "course image unavailable", "course_image_unavailable");
      }

      if (!isAllowedAssetHost(imageUrl, institutionUrl)) {
        throw new AppError(400, "invalid course image host", "invalid_course_image_host");
      }

      if (!request.auth.user.brightspaceStateEncrypted) {
        throw new AppError(400, "connect to d2l first", "not_connected");
      }

      const storageState = decodeStorageState(request.auth.user.brightspaceStateEncrypted);
      const asset = await connectorAssetRequest({
        instanceUrl: institutionUrl,
        storageState,
        assetUrl: imageUrl
      });

      const body = Buffer.from(asset.bodyBase64, "base64");
      reply.header("content-type", asset.contentType || "application/octet-stream");
      reply.header("cache-control", "private, max-age=300");
      return reply.send(body);
    }
  );

  fastify.get(
    "/courses",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const courses = await prisma.course.findMany({
        where: {
          userId: request.auth.user.id
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }]
      });

      const institutionUrl = readString(request.auth.user.institutionUrl);

      return {
        courses: courses.map((course) => {
          const assets = readCourseAssetUrls(course.rawData);

          return {
            ...course,
            courseImageUrl: toAbsoluteUrl(assets.imageUrl, institutionUrl),
            courseHomeUrl: toAbsoluteUrl(assets.homeUrl, institutionUrl)
          };
        })
      };
    }
  );
};

export default coursesRoute;
