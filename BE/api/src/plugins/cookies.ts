import cookie from "@fastify/cookie";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { env } from "../lib/env.js";

const cookiePlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: "onRequest"
  });
};

export default fp(cookiePlugin);
