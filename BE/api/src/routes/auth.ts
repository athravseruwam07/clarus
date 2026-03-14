import bcrypt from "bcryptjs";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { SESSION_COOKIE_NAME } from "../lib/types.js";

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const registerBodySchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  email: z.string().trim().email("email must be valid").toLowerCase(),
  password: z.string().min(8, "password must be at least 8 characters"),
  university: z.string().trim().min(1, "university is required").max(200)
});

const loginBodySchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1, "password is required")
});

const updateProfileBodySchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, "current password is required"),
  newPassword: z.string().min(8, "new password must be at least 8 characters")
});

function writeSessionCookie(reply: FastifyReply, sessionId: string, expiresAt: Date): void {
  const cookieWriter =
    "setCookie" in reply && typeof reply.setCookie === "function"
      ? reply.setCookie.bind(reply)
      : "cookie" in reply && typeof reply.cookie === "function"
        ? reply.cookie.bind(reply)
        : null;

  if (!cookieWriter) {
    throw new AppError(500, "cookie support is unavailable", "cookie_unavailable");
  }

  cookieWriter(SESSION_COOKIE_NAME, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    signed: true,
    expires: expiresAt
  });
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

const authRoute: FastifyPluginAsync = async (fastify) => {
  // POST /v1/auth/register
  fastify.post("/auth/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) {
      throw new AppError(409, "an account with this email already exists", "email_taken");
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        university: body.university,
        passwordHash
      }
    });

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });

    writeSessionCookie(reply, session.id, expiresAt);

    return {
      ok: true,
      user: {
        name: user.name,
        email: user.email,
        university: user.university
      }
    };
  });

  // POST /v1/auth/login
  fastify.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, name: true, email: true, university: true, passwordHash: true }
    });

    if (!user || !user.passwordHash) {
      // Deliberately vague to prevent user enumeration
      throw new AppError(401, "invalid email or password", "invalid_credentials");
    }

    const passwordOk = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordOk) {
      throw new AppError(401, "invalid email or password", "invalid_credentials");
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });

    writeSessionCookie(reply, session.id, expiresAt);

    return {
      ok: true,
      user: {
        name: user.name,
        email: user.email,
        university: user.university
      }
    };
  });

  // POST /v1/auth/logout — Clarus sign-out (keeps D2L state, just ends the session)
  fastify.post(
    "/auth/logout",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      await prisma.session.delete({ where: { id: request.auth.session.id } }).catch(() => undefined);
      clearSessionCookie(reply);

      return { ok: true };
    }
  );

  // GET /v1/auth/profile
  fastify.get(
    "/auth/profile",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const { user } = request.auth;

      return {
        name: user.name,
        email: user.email,
        university: user.university,
        hasClarusAccount: user.passwordHash !== null
      };
    }
  );

  // PATCH /v1/auth/profile — update display name
  fastify.patch(
    "/auth/profile",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const body = updateProfileBodySchema.parse(request.body);

      const updated = await prisma.user.update({
        where: { id: request.auth.user.id },
        data: { name: body.name },
        select: { name: true, email: true, university: true }
      });

      return { ok: true, user: updated };
    }
  );

  // POST /v1/auth/change-password
  fastify.post(
    "/auth/change-password",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const { user } = request.auth;

      if (!user.passwordHash) {
        throw new AppError(400, "no Clarus account password is set", "no_password");
      }

      const body = changePasswordBodySchema.parse(request.body);

      const currentOk = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!currentOk) {
        throw new AppError(401, "current password is incorrect", "wrong_password");
      }

      const newHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
      });

      return { ok: true };
    }
  );

  // DELETE /v1/auth/account
  fastify.delete(
    "/auth/account",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      // Cascade deletes all related data via Prisma onDelete: Cascade
      await prisma.user.delete({ where: { id: request.auth.user.id } });

      clearSessionCookie(reply);

      return { ok: true };
    }
  );
};

export default authRoute;
