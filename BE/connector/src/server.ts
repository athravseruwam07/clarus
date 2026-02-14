import "dotenv/config";

import Fastify from "fastify";
import { ZodError } from "zod";

import { ConnectorError, loginAndCaptureState, requestWithStoredState } from "./d2l.js";
import { loginSchema, requestSchema } from "./schema.js";

function requiredEnv(name: "CONNECTOR_INTERNAL_SECRET" | "PORT"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing env var: ${name}`);
  }

  return value;
}

const connectorSecret = requiredEnv("CONNECTOR_INTERNAL_SECRET");
const port = Number(requiredEnv("PORT"));

const app = Fastify({
  logger: true
});

app.addHook("onRequest", async (request, reply) => {
  const providedHeader = request.headers["x-internal-secret"];
  const providedSecret = Array.isArray(providedHeader) ? providedHeader[0] : providedHeader;

  if (providedSecret !== connectorSecret) {
    reply.code(401).send({
      error: "unauthorized",
      message: "unauthorized"
    });
  }
});

app.post("/internal/login", async (request) => {
  const parsedBody = loginSchema.parse(request.body);

  const result = await loginAndCaptureState({
    instanceUrl: parsedBody.instanceUrl,
    username: parsedBody.username,
    password: parsedBody.password
  });

  return {
    storageState: result.storageState,
    whoami: result.whoami
  };
});

app.post("/internal/request", async (request) => {
  const parsedBody = requestSchema.parse(request.body);

  const data = await requestWithStoredState({
    instanceUrl: parsedBody.instanceUrl,
    storageState: parsedBody.storageState,
    apiPath: parsedBody.apiPath
  });

  return {
    data
  };
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: "invalid_request",
      message: error.issues[0]?.message ?? "invalid request payload"
    });
    return;
  }

  if (error instanceof ConnectorError) {
    if (error.statusCode >= 500) {
      request.log.error({ err: error }, "connector request failed");
    }

    reply.code(error.statusCode).send({
      error: error.code,
      message: error.publicMessage
    });
    return;
  }

  request.log.error({ err: error }, "connector request failed");
  reply.code(500).send({
    error: "internal_error",
    message: "unexpected connector error"
  });
});

try {
  await app.listen({
    port,
    host: "0.0.0.0"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
