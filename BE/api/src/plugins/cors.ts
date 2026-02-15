import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { env } from "../lib/env.js";

function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port;

    // note: we only allow the frontend dev server port here.
    if (port !== "3000") {
      return false;
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
      return true;
    }

    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins = parseOrigins(env.CORS_ORIGIN);

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"]
  });
};

export default fp(corsPlugin);
