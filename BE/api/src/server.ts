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
import dropboxAssignmentsRoute from "./routes/assignments.dropbox.js";
import calendarEventsRoute from "./routes/calendar.events.js";
import contentTopicsRoute from "./routes/content.topics.js";
import quizzesOverviewRoute from "./routes/quizzes.overview.js";
import demoFlowRoutes from "./routes/demo.flow.js";
import itemsStateRoute from "./routes/items.state.js";
import roadmapRoute from "./routes/roadmap.js";
import syncCalendarRoute from "./routes/sync.calendar.js";
import syncCoursesRoute from "./routes/sync.courses.js";
import member1FoundationRoutes from "./routes/workstreams/member1.foundation.js";
import member2IntelligenceRoutes from "./routes/workstreams/member2.intelligence.js";
import member3OptimizationRoutes from "./routes/workstreams/member3.optimization.js";

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
  await app.register(demoFlowRoutes, { prefix: "/v1" });
  await app.register(syncCoursesRoute, { prefix: "/v1" });
  await app.register(syncCalendarRoute, { prefix: "/v1" });
  await app.register(dropboxAssignmentsRoute, { prefix: "/v1" });
  await app.register(calendarEventsRoute, { prefix: "/v1" });
  await app.register(contentTopicsRoute, { prefix: "/v1" });
  await app.register(quizzesOverviewRoute, { prefix: "/v1" });
  await app.register(itemsStateRoute, { prefix: "/v1" });
  await app.register(coursesRoute, { prefix: "/v1" });
  await app.register(roadmapRoute, { prefix: "/v1" });
  await app.register(member1FoundationRoutes, { prefix: "/v1" });
  await app.register(member2IntelligenceRoutes, { prefix: "/v1" });
  await app.register(member3OptimizationRoutes, { prefix: "/v1" });

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
