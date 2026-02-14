import "dotenv/config";

import Fastify from "fastify";

import { toHttpError } from "./lib/errors.js";
import { env } from "./lib/env.js";
import authPlugin from "./plugins/auth.js";
import cookiePlugin from "./plugins/cookies.js";
import corsPlugin from "./plugins/cors.js";
import coursesRoute from "./routes/courses.js";
import d2lConnectRoute from "./routes/d2l.connect.js";
import d2lDisconnectRoute from "./routes/d2l.disconnect.js";
import d2lStatusRoute from "./routes/d2l.status.js";
import syncCoursesRoute from "./routes/sync.courses.js";

async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(corsPlugin);
  await app.register(cookiePlugin);
  await app.register(authPlugin);

  await app.register(d2lConnectRoute, { prefix: "/v1" });
  await app.register(d2lStatusRoute, { prefix: "/v1" });
  await app.register(d2lDisconnectRoute, { prefix: "/v1" });
  await app.register(syncCoursesRoute, { prefix: "/v1" });
  await app.register(coursesRoute, { prefix: "/v1" });

  app.setErrorHandler((error, request, reply) => {
    const mappedError = toHttpError(error);

    if (mappedError.statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    }

    reply.code(mappedError.statusCode).send(mappedError.body);
  });

  return app;
}

const app = await buildServer();

try {
  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
