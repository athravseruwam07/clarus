import { ZodError } from "zod";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly publicMessage: string;

  constructor(statusCode: number, publicMessage: string, code = "app_error") {
    super(publicMessage);
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unexpected error";
}

export function toHttpError(error: unknown): {
  statusCode: number;
  body: { error: string; message: string };
} {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: "invalid_request",
        message: error.issues[0]?.message ?? "invalid request payload"
      }
    };
  }

  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.code,
        message: error.publicMessage
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      error: "internal_error",
      message: "unexpected server error"
    }
  };
}
