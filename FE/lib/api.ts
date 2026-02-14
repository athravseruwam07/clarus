const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4001";

interface ErrorPayload {
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ConnectPayload {
  instanceUrl: string;
  username: string;
  password: string;
}

export interface ConnectResponse {
  connected: true;
  user: {
    name: string;
    email: string;
  };
}

export type ConnectionStatusResponse =
  | {
      connected: true;
      lastVerifiedAt: string;
    }
  | {
      connected: false;
      reason: "expired" | "disconnected";
    };

export interface Course {
  id: string;
  userId: string;
  brightspaceCourseId: string;
  courseName: string;
  courseCode: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncCoursesResponse {
  success: true;
  coursesSynced: number;
}

function parseErrorPayload(payload: unknown): ErrorPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    error: typeof record.error === "string" ? record.error : undefined,
    message: typeof record.message === "string" ? record.message : undefined
  };
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new ApiError(
      "could not reach clarus backend. make sure backend services are running.",
      0,
      "network_error"
    );
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const parsedError = parseErrorPayload(payload);
    throw new ApiError(
      parsedError.message ?? "request failed",
      response.status,
      parsedError.error
    );
  }

  return payload as TResponse;
}

export async function connectD2L(payload: ConnectPayload): Promise<ConnectResponse> {
  return request<ConnectResponse>("/v1/d2l/connect", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getD2LStatus(): Promise<ConnectionStatusResponse> {
  return request<ConnectionStatusResponse>("/v1/d2l/status", {
    method: "GET"
  });
}

export async function disconnectD2L(): Promise<{ success: true }> {
  return request<{ success: true }>("/v1/d2l/disconnect", {
    method: "POST"
  });
}

export async function syncCourses(): Promise<SyncCoursesResponse> {
  return request<SyncCoursesResponse>("/v1/sync/courses", {
    method: "POST"
  });
}

export async function getCourses(): Promise<Course[]> {
  const response = await request<{ courses: Course[] }>("/v1/courses", {
    method: "GET"
  });

  return response.courses;
}
