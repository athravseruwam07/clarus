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
  username?: string;
  password?: string;
  mode?: "manual" | "credentials";
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

export interface PlaceholderResponse {
  implemented: false;
  feature: string;
  lane: string;
  message: string;
  nextAction: string;
  requestEcho: {
    path: string;
    method: string;
    query: unknown;
    body: unknown;
  };
}

export interface RoadmapFeatureContract {
  feature: string;
  lane: string;
  method: "GET" | "POST";
  path: string;
  backendWorkspace: string;
}

export interface DemoTimelineItem {
  assignmentId: string;
  title: string;
  courseName: string;
  assessmentType: "assignment" | "quiz" | "discussion" | "lab" | "project";
  dueAt: string;
  priorityScore: number;
  riskScore: number;
  effortHours: number;
  recommendedStartDate: string;
  recentlyChanged: boolean;
}

export interface DemoDashboardData {
  highestLeverageTask: {
    assignmentId: string;
    title: string;
    reason: string;
    riskScore: number;
    effortHours: number;
  };
  riskAlert: {
    headline: string;
    explanation: string;
    mitigation: string;
  };
  workloadPreview: {
    heavyWeekDetected: boolean;
    weekLabel: string;
    estimatedHours: number;
    recommendation: string;
  };
  timeline: DemoTimelineItem[];
}

export interface DemoAssignmentIntelligence {
  assignmentId: string;
  title: string;
  courseName: string;
  dueAt: string;
  complexityScore: number;
  effortHours: number;
  riskScore: number;
  riskDrivers: string[];
  recommendedStartDate: string;
  highestLeverageNextStep: string;
  checklist: Array<{
    id: string;
    text: string;
    category: "submission" | "rubric" | "format" | "citation" | "hidden";
    completed: boolean;
  }>;
  contentLocator: Array<{
    priority: number;
    module: string;
    lecture: string;
    resource: string;
    section: string;
    whyRelevant: string;
    confidence: number;
  }>;
  sessionPlan: Array<{
    label: string;
    durationMinutes: number;
    objective: string;
  }>;
}

export interface DemoInsightsData {
  workloadHeatmap: Array<{ week: string; estimatedHours: number; intensity: "low" | "medium" | "high" }>;
  riskForecast: Array<{ week: string; riskScore: number; label: string }>;
  knowledgeGaps: Array<{ concept: string; confidence: number; recommendation: string }>;
  behaviorTrends: {
    averageStartLeadDays: number;
    snoozeRate: number;
    estimatedVsActualDriftPct: number;
  };
}

export interface DemoCopilotResponse {
  answer: string;
  suggestedPlan: string[];
  linkedAssignments: Array<{ assignmentId: string; title: string; reason: string }>;
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
    const headers = new Headers(init?.headers);
    const hasBody = init?.body !== undefined && init?.body !== null;
    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers
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

export async function getFeatureRoadmap(): Promise<RoadmapFeatureContract[]> {
  const response = await request<{ features: RoadmapFeatureContract[] }>("/v1/roadmap/features", {
    method: "GET"
  });

  return response.features;
}

export async function runFullSyncPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/sync/full", {
    method: "POST"
  });
}

export async function getTimelinePlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/timeline/intelligence", {
    method: "GET"
  });
}

export async function getChangeFeedPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/changes/impact", {
    method: "GET"
  });
}

export async function getWorkloadRadarPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/workload/forecast", {
    method: "GET"
  });
}

export async function getAssignmentBreakdownPlaceholder(payload: unknown): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/assignments/breakdown", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getContentLocatorPlaceholder(payload: unknown): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/content-locator/resolve", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getKnowledgeGapsPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/knowledge-gaps/detect", {
    method: "GET"
  });
}

export async function getSmartRemindersPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/reminders/adaptive", {
    method: "GET"
  });
}

export async function getRiskPredictionPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/risk/predict", {
    method: "GET"
  });
}

export async function getEffortEstimationPlaceholder(payload: unknown): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/effort/estimate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getSubmissionGradeTrackerPlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/performance/tracker", {
    method: "GET"
  });
}

export async function getStudyPlanOptimizerPlaceholder(payload: unknown): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/study-plan/optimize", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getPrioritizationEnginePlaceholder(): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/prioritization/top-task", {
    method: "GET"
  });
}

export async function getRubricScoringPlaceholder(payload: unknown): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/rubric/score-draft", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getCopilotModePlaceholder(payload: unknown): Promise<PlaceholderResponse> {
  return request<PlaceholderResponse>("/v1/copilot/respond", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getDemoDashboardData(): Promise<DemoDashboardData> {
  return request<DemoDashboardData>("/v1/demo/dashboard", {
    method: "GET"
  });
}

export async function getDemoAssignmentIntelligence(assignmentId: string): Promise<DemoAssignmentIntelligence> {
  return request<DemoAssignmentIntelligence>(`/v1/demo/assignments/${assignmentId}`, {
    method: "GET"
  });
}

export async function startDemoSession(payload: {
  assignmentId: string;
  plannedMinutes: number;
}): Promise<{
  sessionId: string;
  assignmentId: string;
  plannedMinutes: number;
  startedAt: string;
  adaptiveNote: string;
}> {
  return request("/v1/demo/sessions/start", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getDemoInsights(): Promise<DemoInsightsData> {
  return request<DemoInsightsData>("/v1/demo/insights", {
    method: "GET"
  });
}

export async function askDemoCopilot(message: string): Promise<DemoCopilotResponse> {
  return request<DemoCopilotResponse>("/v1/demo/copilot", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}
