import type { FastifyPluginAsync } from "fastify";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

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

      return {
        courses
      };
    }
  );
};

export default coursesRoute;
