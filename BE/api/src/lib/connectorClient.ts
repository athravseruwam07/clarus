import { AppError } from "./errors.js";
import { env } from "./env.js";
import type { ConnectorLoginResponse, ConnectorRequestResponse } from "./types.js";

type JsonRecord = Record<string, unknown>;
const DEFAULT_CONNECTOR_TIMEOUT_MS = 65000;
const DEFAULT_CONNECTOR_LOGIN_TIMEOUT_MS = 240000;

function getMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }

  const message = (body as JsonRecord)["message"];
  return typeof message === "string" ? message : undefined;
}

function getErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }

  const error = (body as JsonRecord)["error"];
  return typeof error === "string" ? error : undefined;
}

async function callConnector<TResponse>(
  path: string,
  payload: unknown,
  options?: { timeoutMs?: number }
): Promise<TResponse> {
  let response: Response;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? DEFAULT_CONNECTOR_TIMEOUT_MS
    );

    response = await fetch(`${env.CONNECTOR_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": env.CONNECTOR_INTERNAL_SECRET
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);
  } catch {
    throw new AppError(502, "connector unavailable", "connector_unavailable");
  }

  const textBody = await response.text();
  let parsedBody: unknown = null;

  if (textBody.length > 0) {
    try {
      parsedBody = JSON.parse(textBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const errorCode = getErrorCode(parsedBody);

    if (response.status === 401 && errorCode === "session_expired") {
      throw new AppError(401, "session expired", "session_expired");
    }

    if (response.status >= 500) {
      throw new AppError(502, "connector unavailable", "connector_unavailable");
    }

    const message = getMessage(parsedBody) ?? "connector request failed";
    throw new AppError(response.status, message, errorCode ?? "connector_request_failed");
  }

  if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
    throw new AppError(502, "connector unavailable", "connector_invalid_response");
  }

  return parsedBody as TResponse;
}

export async function connectorLogin(payload: {
  instanceUrl: string;
  username: string;
  password: string;
}): Promise<ConnectorLoginResponse> {
  return callConnector<ConnectorLoginResponse>("/internal/login", payload);
}

export async function connectorManualLogin(payload: {
  instanceUrl: string;
}): Promise<ConnectorLoginResponse> {
  return callConnector<ConnectorLoginResponse>("/internal/login/manual", payload, {
    timeoutMs: DEFAULT_CONNECTOR_LOGIN_TIMEOUT_MS
  });
}

export async function connectorRequest<TData>(payload: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  apiPath: string;
}): Promise<ConnectorRequestResponse<TData>> {
  return callConnector<ConnectorRequestResponse<TData>>("/internal/request", payload);
}
