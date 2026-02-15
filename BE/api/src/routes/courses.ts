import type { FastifyPluginAsync } from "fastify";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

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

const coursesRoute: FastifyPluginAsync = async (fastify) => {
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
