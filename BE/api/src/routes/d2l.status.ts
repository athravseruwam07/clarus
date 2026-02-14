import type { FastifyPluginAsync } from "fastify";

import { connectorRequest } from "../lib/connectorClient.js";
import { AppError, isAppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";
import { WHOAMI_API_PATH } from "../lib/valence.js";

const d2lStatusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/d2l/status",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        return {
          connected: false,
          reason: "disconnected"
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
          lastVerifiedAt: now.toISOString()
        };
      } catch (error) {
        if (isAppError(error) && error.code === "session_expired") {
          return {
            connected: false,
            reason: "expired"
          };
        }

        throw error;
      }
    }
  );
};

export default d2lStatusRoute;
