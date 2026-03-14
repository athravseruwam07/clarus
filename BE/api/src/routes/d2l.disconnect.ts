import type { FastifyPluginAsync } from "fastify";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { SESSION_COOKIE_NAME } from "../lib/types.js";

const d2lDisconnectRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/d2l/disconnect",
    {
      preHandler: fastify.requireAuth
    },
    async (request, reply) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      await prisma.user.update({
        where: { id: request.auth.user.id },
        data: {
          brightspaceStateEncrypted: null,
          stateLastVerifiedAt: null
        }
      });

      const hasClarusAccount = request.auth.user.passwordHash !== null;

      if (!hasClarusAccount) {
        // Guest user — full sign-out: delete session and clear cookie
        await prisma.session.delete({ where: { id: request.auth.session.id } }).catch(() => undefined);

        if ("clearCookie" in reply && typeof reply.clearCookie === "function") {
          reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
        } else if ("cookie" in reply && typeof reply.cookie === "function") {
          reply.cookie(SESSION_COOKIE_NAME, "", {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            expires: new Date(0)
          });
        } else {
          throw new AppError(500, "cookie support is unavailable", "cookie_unavailable");
        }
      }
      // Clarus account users keep their session — they stay signed in to Clarus,
      // they just need to reconnect D2L.

      return {
        success: true
      };
    }
  );
};

export default d2lDisconnectRoute;
