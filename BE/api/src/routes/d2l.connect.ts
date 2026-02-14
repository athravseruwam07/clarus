import type { FastifyPluginAsync } from "fastify";

import { connectorLogin, connectorRequest } from "../lib/connectorClient.js";
import { encryptString } from "../lib/encryption.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";
import { SESSION_COOKIE_NAME } from "../lib/types.js";
import { WHOAMI_API_PATH, normalizeInstanceUrl, parseWhoami } from "../lib/valence.js";
import { connectBodySchema } from "../schema.js";

const d2lConnectRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/d2l/connect", async (request, reply) => {
    const parsedBody = connectBodySchema.parse(request.body);
    const instanceUrl = normalizeInstanceUrl(parsedBody.instanceUrl);
    const email = parsedBody.username.trim();

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        brightspaceUsername: true,
        institutionUrl: true,
        brightspaceStateEncrypted: true
      }
    });

    if (
      existingUser?.institutionUrl === instanceUrl &&
      typeof existingUser.brightspaceStateEncrypted === "string" &&
      existingUser.brightspaceStateEncrypted.length > 0
    ) {
      try {
        const storageState = decodeStorageState(existingUser.brightspaceStateEncrypted);
        const whoamiResponse = await connectorRequest<Record<string, unknown>>({
          instanceUrl,
          storageState,
          apiPath: WHOAMI_API_PATH
        });

        const whoami = parseWhoami(whoamiResponse.data);
        const now = new Date();

        const user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            brightspaceUserId: whoami.brightspaceUserId,
            brightspaceUsername: whoami.brightspaceUsername,
            name: whoami.name,
            stateLastVerifiedAt: now
          }
        });

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            expiresAt
          }
        });

        const cookieWriter =
          "setCookie" in reply && typeof reply.setCookie === "function"
            ? reply.setCookie.bind(reply)
            : "cookie" in reply && typeof reply.cookie === "function"
              ? reply.cookie.bind(reply)
              : null;

        if (!cookieWriter) {
          throw new AppError(500, "cookie support is unavailable", "cookie_unavailable");
        }

        cookieWriter(SESSION_COOKIE_NAME, session.id, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          signed: true,
          expires: expiresAt
        });

        return {
          connected: true,
          user: {
            name: user.name ?? user.brightspaceUsername ?? user.email,
            email: user.email
          }
        };
      } catch (error) {
        // if the stored session is expired or invalid, fall through to fresh login
        request.log.info({ err: error }, "stored session invalid, retrying login");
      }
    }

    const loginResult = await connectorLogin({
      instanceUrl,
      username: email,
      password: parsedBody.password
    });

    const whoami = parseWhoami(loginResult.whoami);
    const encryptedState = encryptString(JSON.stringify(loginResult.storageState));

    const now = new Date();

    const user = await prisma.user.upsert({
      where: {
        email
      },
      update: {
        institutionUrl: instanceUrl,
        brightspaceUserId: whoami.brightspaceUserId,
        brightspaceUsername: whoami.brightspaceUsername,
        name: whoami.name,
        brightspaceStateEncrypted: encryptedState,
        stateLastVerifiedAt: now
      },
      create: {
        email,
        institutionUrl: instanceUrl,
        brightspaceUserId: whoami.brightspaceUserId,
        brightspaceUsername: whoami.brightspaceUsername,
        name: whoami.name,
        brightspaceStateEncrypted: encryptedState,
        stateLastVerifiedAt: now
      }
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt
      }
    });

    const cookieWriter =
      "setCookie" in reply && typeof reply.setCookie === "function"
        ? reply.setCookie.bind(reply)
        : "cookie" in reply && typeof reply.cookie === "function"
          ? reply.cookie.bind(reply)
          : null;

    if (!cookieWriter) {
      throw new AppError(500, "cookie support is unavailable", "cookie_unavailable");
    }

    cookieWriter(SESSION_COOKIE_NAME, session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      signed: true,
      expires: expiresAt
    });

    return {
      connected: true,
      user: {
        name: user.name ?? user.brightspaceUsername ?? user.email,
        email: user.email
      }
    };
  });
};

export default d2lConnectRoute;
