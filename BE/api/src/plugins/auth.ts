import type { Session, User } from "@prisma/client";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { prisma } from "../lib/prisma.js";
import { SESSION_COOKIE_NAME } from "../lib/types.js";

export interface AuthContext {
  session: Session;
  user: User;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }

  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function clearSessionCookie(reply: FastifyReply): void {
  if ("clearCookie" in reply && typeof reply.clearCookie === "function") {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return;
  }

  if ("cookie" in reply && typeof reply.cookie === "function") {
    reply.cookie(SESSION_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      expires: new Date(0)
    });
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("auth", null);

  fastify.addHook("preHandler", async (request, reply) => {
    request.auth = null;

    const signedSessionCookie = request.cookies[SESSION_COOKIE_NAME];
    if (!signedSessionCookie) {
      return;
    }

    const unsignedCookie = request.unsignCookie(signedSessionCookie);
    const sessionId = unsignedCookie.valid
      ? unsignedCookie.value
      : !signedSessionCookie.startsWith("s:")
        ? signedSessionCookie
        : null;

    if (!sessionId) {
      clearSessionCookie(reply);
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session) {
      return;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      clearSessionCookie(reply);
      return;
    }

    request.auth = {
      session,
      user: session.user
    };

    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      })
      .catch(() => undefined);
  });

  fastify.decorate("requireAuth", async (request, reply) => {
    if (request.auth) {
      return;
    }

    reply.code(401).send({ error: "unauthorized", message: "authentication required" });
  });
};

export default fp(authPlugin);
