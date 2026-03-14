import type { FastifyPluginAsync } from "fastify";

import { connectorRequest } from "../lib/connectorClient.js";
import { AppError, isAppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";
import { WHOAMI_API_PATH } from "../lib/valence.js";

const d2lProfileRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/d2l/profile",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const user = request.auth.user;
      const profile = {
        name: user.name ?? user.brightspaceUsername ?? user.email,
        email: user.email,
        brightspaceUsername: user.brightspaceUsername,
        institutionUrl: user.institutionUrl,
        d2lHomeUrl: user.institutionUrl ? `${new URL(user.institutionUrl).origin}/d2l/home` : null
      };

      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        return {
          connected: false,
          reason: "disconnected",
          lastVerifiedAt: user.stateLastVerifiedAt?.toISOString() ?? null,
          profile
        };
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);

      try {
        await connectorRequest({
          instanceUrl: user.institutionUrl,
          storageState,
          apiPath: WHOAMI_API_PATH
        });

        const now = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { stateLastVerifiedAt: now }
        });

        return {
          connected: true,
          lastVerifiedAt: now.toISOString(),
          profile
        };
      } catch (error) {
        if (isAppError(error) && error.code === "session_expired") {
          return {
            connected: false,
            reason: "expired",
            lastVerifiedAt: user.stateLastVerifiedAt?.toISOString() ?? null,
            profile
          };
        }

        throw error;
      }
    }
  );
};

export default d2lProfileRoute;
