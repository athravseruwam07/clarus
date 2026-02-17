const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4001";

interface ErrorPayload {
  error?: string;
  message?: string;
}

export type OverviewTargetType =
  | "dropbox"
  | "content_topic"
  | "quiz"
  | "calendar_event"
  | "work_plan_optimizer";

export interface ItemStateDTO {
  targetType: OverviewTargetType;
  targetKey: string;
  checkedIds: string[];
  locationText: string | null;
  notesText: string | null;
  updatedAt: string;
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

export type D2LProfileResponse =
  | {
      connected: true;
      lastVerifiedAt: string;
      profile: {
        name: string;
        email: string;
        brightspaceUsername: string | null;
        institutionUrl: string | null;
        d2lHomeUrl: string | null;
      };
    }
  | {
      connected: false;
      reason: "expired" | "disconnected";
      lastVerifiedAt: string | null;
      profile: {
        name: string;
        email: string;
        brightspaceUsername: string | null;
        institutionUrl: string | null;
        d2lHomeUrl: string | null;
      };
    };

export interface Course {
  id: string;
  userId: string;
  brightspaceCourseId: string;
  courseName: string;
  courseCode: string | null;
  courseImageUrl?: string | null;
  courseHomeUrl?: string | null;
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

export type WorkItemType =
  | "assignment"
  | "quiz"
  | "test"
  | "discussion"
  | "lab"
  | "project"
  | "reading"
  | "presentation"
  | "other";

export interface WorkPlanWorkItemInput {
  id: string;
  title: string;
  type: WorkItemType;
  dueAt: string;
  estimatedMinutes: number;
  complexityScore: number;
  riskScore: number;
  priorityScore: number;
  gradeWeight: number;
}

export interface WorkPlanOptimizeRequest {
  availability: {
    timezone: string;
    weekdayMinutes: number;
    weekendMinutes: number;
    overrides: Partial<
      Record<
        "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
        number
      >
    >;
  };
  pace: {
    productivityProfile: "slow" | "steady" | "fast";
    focusMinutesPerSession: number;
    breakMinutes: number;
  };
  priorities: {
    preferHighRisk: boolean;
    preferHighWeight: boolean;
    preferNearDeadline: boolean;
  };
  behavior: {
    sessionsSkippedLast7d: number;
    recentSnoozeRate: number;
    avgCompletionDriftPct: number;
    preferredTimeOfDay: "morning" | "afternoon" | "evening";
  };
  recompute: {
    trigger: "initial" | "session_skipped" | "workload_changed";
    workloadChangeNote: string;
    newAssessmentsAdded: number;
  };
  workItems: WorkPlanWorkItemInput[];
}

export interface WorkPlanOptimizeResponse {
  planType: "student_work_plan_optimizer";
  generatedAt: string;
  summary: {
    totalWorkItems: number;
    totalEstimatedHours: number;
    totalScheduledHours: number;
    daysPlanned: number;
    recomputed: boolean;
    spacedRepetitionBlocks: number;
  };
  nextBestAction: {
    workItemId: string;
    title: string;
    action: string;
    reason: string;
    recommendedTodayMinutes: number;
  };
  adjustments: Array<{
    kind: "behavior" | "workload" | "risk" | "capacity";
    title: string;
    description: string;
  }>;
  explanations: string[];
  dailyPlan: Array<{
    date: string;
    totalMinutes: number;
    focusWindow: "morning" | "afternoon" | "evening";
    tasks: Array<{
      blockId: string;
      workItemId: string;
      title: string;
      type: WorkItemType;
      mode: "prep" | "execution" | "spaced_repetition" | "review";
      minutes: number;
      dueAt: string;
      priorityRank: number;
      isLatePlacement: boolean;
      reason: string;
    }>;
  }>;
}

export interface WorkPlanContextItem {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  type: "assignment" | "quiz" | "discussion" | "project" | "lab" | "other";
  dueAt: string;
  taskUrl: string;
  submissionUrl: string;
  assignmentUrl: string;
  estimatedMinutes: number;
  complexityScore: number;
  riskScore: number;
  gradeWeight: number;
  priorityScore: number;
  priorityBreakdown: {
    deadlineProximity: number;
    risk: number;
    gradeWeight: number;
    complexity: number;
    effort: number;
    knowledgeGapImpact: number;
    total: number;
  };
  delayImpactIfDeferred24h: number;
  contentLocator: Array<{
    module: string;
    lecture: string;
    resource: string;
    section: string;
    url: string;
    whyRelevant: string;
    confidence: number;
  }>;
  checklistTasks: Array<{
    id: string;
    text: string;
  }>;
  recentlyChanged: boolean;
}

export interface WorkPlanContextResponse {
  generatedAt: string;
  currentDateIso: string;
  activeCourses: Array<{
    courseId: string;
    courseName: string;
    courseCode: string | null;
    courseUrl: string;
    moduleCount: number;
    contentPreview: Array<{
      module: string;
      lecture: string;
      resource: string;
      section: string;
      url: string;
      whyRelevant: string;
      confidence: number;
    }>;
  }>;
  workItems: WorkPlanContextItem[];
  highestLeverageTask: {
    id: string;
    title: string;
    courseName: string;
    priorityScore: number;
    delayImpactIfDeferred24h: number;
    scoreBreakdown: {
      deadlineProximity: number;
      risk: number;
      gradeWeight: number;
      complexity: number;
      effort: number;
      knowledgeGapImpact: number;
      total: number;
    };
    reason: string;
  } | null;
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

export interface CopilotCitationDTO {
  id: string;
  type: "course" | "timeline_event" | "ai_brief" | "item_state";
  label: string;
  href: string | null;
  internalPath: string | null;
}

export interface CopilotMessageDTO {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: CopilotCitationDTO[];
  actions: string[];
  followUps: string[];
  confidence: "high" | "medium" | "low" | null;
  model: string | null;
  createdAt: string;
}

export interface CopilotThreadDTO {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string | null;
}

export interface CopilotAskResponseDTO {
  threadId: string;
  userMessageId: string;
  assistantMessage: CopilotMessageDTO;
  actions: string[];
  citations: CopilotCitationDTO[];
  followUps: string[];
  confidence: "high" | "medium" | "low" | null;
}

export type TimelineSourceType =
  | "calendar"
  | "content_module"
  | "content_topic"
  | "dropbox_folder"
  | "quiz"
  | "discussion_forum"
  | "discussion_topic"
  | "checklist"
  | "generic";

export type TimelineDateKind = "event" | "start" | "due" | "end";

export interface TimelineEventDTO {
  // Stable synthetic id: `${sourceType}:${sourceId}:${dateKind}` (do not parse; use `sourceId/sourceType/dateKind`).
  id: string;
  sourceId: string;
  orgUnitId: string;
  courseName: string | null;
  courseCode: string | null;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  sourceType: TimelineSourceType;
  dateKind: TimelineDateKind;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
  viewUrl: string | null;
}

export interface CalendarTimelineResponse {
  lastSyncedAt: string | null;
  needsSync: boolean;
  events: TimelineEventDTO[];
}

export interface SyncCalendarResponse {
  success: true;
  eventsFetched: number;
  eventsUpserted: number;
  eventsDeleted: number;
  orgUnitsForbidden?: string[];
  duplicatesSkipped?: number;
  countsBySource?: Record<string, number>;
  windowStart: string;
  windowEnd: string;
  syncedAt: string;
}

export interface DropboxRubricCriterionDTO {
  id: string;
  name: string;
  exemplaryText: string | null;
}

export interface DropboxRubricDTO {
  rubricId: string;
  name: string;
  criteria: DropboxRubricCriterionDTO[];
}

export type DropboxAttachmentDTO =
  | { kind: "file"; fileId: string; name: string; sizeBytes: number }
  | { kind: "link"; linkId: string; name: string; href: string };

export interface DropboxAssignmentOverviewDTO {
  orgUnitId: string;
  folderId: string;
  courseName: string | null;
  courseCode: string | null;
  title: string;
  dueAt: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  pointsPossible: number | null;
  submissionType: "file" | "text" | "on_paper" | "observed" | "file_or_text" | "unknown";
  completionType: "on_submission" | "due_date" | "manually_by_learner" | "on_evaluation" | "unknown";
  dropboxType: "individual" | "group" | "unknown";
  instructionsText: string | null;
  instructionsHtml: string | null;
  rubrics: DropboxRubricDTO[];
  attachments: Array<Extract<DropboxAttachmentDTO, { kind: "file" }>>;
  linkAttachments: Array<Extract<DropboxAttachmentDTO, { kind: "link" }>>;
}

export interface ContentTopicOverviewDTO {
  orgUnitId: string;
  topicId: string;
  courseName: string | null;
  courseCode: string | null;
  title: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  isHidden: boolean;
  isLocked: boolean;
  isBroken: boolean;
  openAsExternalResource: boolean;
  topicType: number | null;
  activityType: number | null;
  toolId: number | null;
  toolItemId: number | null;
  gradeItemId: number | null;
  descriptionText: string | null;
  descriptionHtml: string | null;
  openUrl: string | null;
}

export interface QuizOverviewDTO {
  orgUnitId: string;
  quizId: string;
  courseName: string | null;
  courseCode: string | null;
  title: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  descriptionText: string | null;
  instructionsText: string | null;
  openUrl: string;
}

export interface AssignmentAiChecklistItemDTO {
  id: string;
  title: string;
  details: string | null;
  category: "planning" | "research" | "writing" | "practice" | "rubric" | "submission" | "review" | "admin";
  estimatedMinutes: number | null;
}

export interface AssignmentAiScheduleItemDTO {
  label: string;
  durationMinutes: number;
  objective: string;
}

export interface AssignmentAiBriefDTO {
  tldr: string;
  deliverables: string[];
  checklist: AssignmentAiChecklistItemDTO[];
  schedule: AssignmentAiScheduleItemDTO[];
  questionsToClarify: string[];
  riskFlags: string[];
}

export interface ForecastAssessment {
  id: string;
  title: string;
  courseName: string;
  courseCode: string;
  assessmentType: "assignment" | "quiz" | "midterm" | "lab" | "project" | "discussion";
  dueDate: string;
  estimatedHours: number;
  complexity: "low" | "medium" | "high";
  weight: number;
  sourceType: string;
  sourceId: string;
  orgUnitId: string;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
  viewUrl: string | null;
}

export interface WeekFeatureVector {
  assessmentCount: number;
  totalEstimatedHours: number;
  complexityMix: { low: number; medium: number; high: number };
  deadlineClusterScore: "low" | "medium" | "high";
  overlapScore: "low" | "medium" | "high";
  typeDistribution: Record<string, number>;
}

export type WorkloadSeverity = "light" | "moderate" | "heavy" | "critical";

export interface RedistributionSuggestion {
  type: "start_earlier" | "split_prep";
  assessmentId: string;
  assessmentTitle: string;
  suggestion: string;
  hoursSaved: number;
  fromWeek: string;
  toWeek: string;
}

export interface WeekForecast {
  weekLabel: string;
  dateRange: string;
  workloadScore: number;
  severity: WorkloadSeverity;
  confidence: number;
  featureVector: WeekFeatureVector;
  assessments: ForecastAssessment[];
  topLoadDrivers: string[];
  suggestions: RedistributionSuggestion[];
}

export interface WorkloadForecastData {
  generatedAt: string;
  forecastWindowWeeks: number;
  courses: string[];
  weeks: WeekForecast[];
  overallSummary: string;
  heavyWeekCount: number;
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

    // Client hints for timezone-safe rendering and AI context.
    if (typeof window !== "undefined") {
      try {
        headers.set("x-client-timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        headers.set("x-client-locale", navigator.language);
      } catch {
        // ignore
      }
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

export async function getD2LProfile(): Promise<D2LProfileResponse> {
  return request<D2LProfileResponse>("/v1/d2l/profile", {
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

export async function syncCalendar(): Promise<SyncCalendarResponse> {
  return request<SyncCalendarResponse>("/v1/sync/calendar", {
    method: "POST"
  });
}

export async function getDropboxAssignmentOverview(params: {
  orgUnitId: string;
  folderId: string;
}): Promise<DropboxAssignmentOverviewDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const folderId = encodeURIComponent(params.folderId);
  return request<DropboxAssignmentOverviewDTO>(`/v1/assignments/dropbox/${orgUnitId}/${folderId}`, {
    method: "GET"
  });
}

export async function generateDropboxAssignmentBrief(params: {
  orgUnitId: string;
  folderId: string;
}): Promise<AssignmentAiBriefDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const folderId = encodeURIComponent(params.folderId);
  return request<AssignmentAiBriefDTO>(`/v1/assignments/dropbox/${orgUnitId}/${folderId}/ai/brief`, {
    method: "POST"
  });
}

export async function getDropboxAssignmentBrief(params: {
  orgUnitId: string;
  folderId: string;
}): Promise<AssignmentAiBriefDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const folderId = encodeURIComponent(params.folderId);
  return request<AssignmentAiBriefDTO>(`/v1/assignments/dropbox/${orgUnitId}/${folderId}/ai/brief`, {
    method: "GET"
  });
}

export async function getContentTopicOverview(params: {
  orgUnitId: string;
  topicId: string;
}): Promise<ContentTopicOverviewDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const topicId = encodeURIComponent(params.topicId);
  return request<ContentTopicOverviewDTO>(`/v1/content/topics/${orgUnitId}/${topicId}`, { method: "GET" });
}

export async function generateContentTopicBrief(params: {
  orgUnitId: string;
  topicId: string;
}): Promise<AssignmentAiBriefDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const topicId = encodeURIComponent(params.topicId);
  return request<AssignmentAiBriefDTO>(`/v1/content/topics/${orgUnitId}/${topicId}/ai/brief`, { method: "POST" });
}

export async function getContentTopicBrief(params: {
  orgUnitId: string;
  topicId: string;
}): Promise<AssignmentAiBriefDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const topicId = encodeURIComponent(params.topicId);
  return request<AssignmentAiBriefDTO>(`/v1/content/topics/${orgUnitId}/${topicId}/ai/brief`, { method: "GET" });
}

export async function getQuizOverview(params: {
  orgUnitId: string;
  quizId: string;
}): Promise<QuizOverviewDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const quizId = encodeURIComponent(params.quizId);
  return request<QuizOverviewDTO>(`/v1/quizzes/${orgUnitId}/${quizId}`, { method: "GET" });
}

export async function generateQuizBrief(params: {
  orgUnitId: string;
  quizId: string;
}): Promise<AssignmentAiBriefDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const quizId = encodeURIComponent(params.quizId);
  return request<AssignmentAiBriefDTO>(`/v1/quizzes/${orgUnitId}/${quizId}/ai/brief`, { method: "POST" });
}

export async function getQuizBrief(params: {
  orgUnitId: string;
  quizId: string;
}): Promise<AssignmentAiBriefDTO> {
  const orgUnitId = encodeURIComponent(params.orgUnitId);
  const quizId = encodeURIComponent(params.quizId);
  return request<AssignmentAiBriefDTO>(`/v1/quizzes/${orgUnitId}/${quizId}/ai/brief`, { method: "GET" });
}

export async function getCourses(): Promise<Course[]> {
  const response = await request<{ courses: Course[] }>("/v1/courses", {
    method: "GET"
  });

  return response.courses;
}

export async function getCalendarEvents(params: {
  from: string;
  to: string;
  orgUnitId?: string | null;
  include?: TimelineDateKind[];
  sources?: TimelineSourceType[];
}): Promise<CalendarTimelineResponse> {
  const searchParams = new URLSearchParams({
    from: params.from,
    to: params.to
  });

  if (params.orgUnitId) {
    searchParams.set("orgUnitId", params.orgUnitId);
  }

  if (params.include && params.include.length > 0) {
    searchParams.set("include", params.include.join(","));
  }

  if (params.sources && params.sources.length > 0) {
    searchParams.set("sources", params.sources.join(","));
  }

  return request<CalendarTimelineResponse>(`/v1/timeline/intelligence?${searchParams.toString()}`, {
    method: "GET"
  });
}

export async function getCalendarEvent(eventId: string): Promise<TimelineEventDTO> {
  const id = encodeURIComponent(eventId);
  return request<TimelineEventDTO>(`/v1/calendar/events/${id}`, { method: "GET" });
}

export async function generateCalendarEventBrief(eventId: string): Promise<AssignmentAiBriefDTO> {
  const id = encodeURIComponent(eventId);
  return request<AssignmentAiBriefDTO>(`/v1/calendar/events/${id}/ai/brief`, { method: "POST" });
}

export async function getCalendarEventBrief(eventId: string): Promise<AssignmentAiBriefDTO> {
  const id = encodeURIComponent(eventId);
  return request<AssignmentAiBriefDTO>(`/v1/calendar/events/${id}/ai/brief`, { method: "GET" });
}

export async function getItemState(params: {
  targetType: OverviewTargetType;
  targetKey: string;
}): Promise<ItemStateDTO> {
  const searchParams = new URLSearchParams({
    targetType: params.targetType,
    targetKey: params.targetKey
  });
  return request<ItemStateDTO>(`/v1/items/state?${searchParams.toString()}`, { method: "GET" });
}

export async function putItemState(payload: {
  targetType: OverviewTargetType;
  targetKey: string;
  checkedIds?: string[];
  locationText?: string | null;
  notesText?: string | null;
}): Promise<ItemStateDTO> {
  return request<ItemStateDTO>("/v1/items/state", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function listCopilotThreads(): Promise<CopilotThreadDTO[]> {
  const response = await request<{ threads: CopilotThreadDTO[] }>("/v1/copilot/threads", {
    method: "GET"
  });
  return response.threads;
}

export async function createCopilotThread(payload?: {
  title?: string;
  initialMessage?: string;
  context?: { activeOrgUnitId?: string; activePage?: string };
}): Promise<{ thread: CopilotThreadDTO; assistantMessage: CopilotMessageDTO | null }> {
  return request<{ thread: CopilotThreadDTO; assistantMessage: CopilotMessageDTO | null }>(
    "/v1/copilot/threads",
    {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }
  );
}

export async function getCopilotMessages(
  threadId: string,
  params?: { cursor?: string; limit?: number }
): Promise<{ messages: CopilotMessageDTO[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params?.cursor) {
    query.set("cursor", params.cursor);
  }
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }
  const suffix = query.toString();
  return request<{ messages: CopilotMessageDTO[]; nextCursor: string | null }>(
    `/v1/copilot/threads/${encodeURIComponent(threadId)}/messages${suffix ? `?${suffix}` : ""}`,
    { method: "GET" }
  );
}

export async function sendCopilotMessage(payload: {
  threadId: string;
  message: string;
  context?: { activeOrgUnitId?: string; activePage?: string };
}): Promise<CopilotAskResponseDTO> {
  return request<CopilotAskResponseDTO>(`/v1/copilot/threads/${encodeURIComponent(payload.threadId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: payload.message,
      context: payload.context
    })
  });
}

export async function deleteCopilotThread(threadId: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/v1/copilot/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE"
  });
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

export async function optimizeStudentWorkPlan(
  payload: WorkPlanOptimizeRequest
): Promise<WorkPlanOptimizeResponse> {
  return request<WorkPlanOptimizeResponse>("/v1/work-plan/optimize", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getWorkPlanContext(params?: {
  refresh?: boolean;
}): Promise<WorkPlanContextResponse> {
  const searchParams = new URLSearchParams();
  if (params?.refresh) {
    searchParams.set("refresh", "1");
  }

  const suffix = searchParams.toString();
  const path = `/v1/work-plan/context${suffix ? `?${suffix}` : ""}`;
  return request<WorkPlanContextResponse>(path, {
    method: "GET"
  });
}

export async function getStudyPlanOptimizerPlaceholder(
  payload: WorkPlanOptimizeRequest
): Promise<WorkPlanOptimizeResponse> {
  return optimizeStudentWorkPlan(payload);
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

export async function getWorkloadForecast(): Promise<WorkloadForecastData> {
  return request<WorkloadForecastData>("/v1/workload/forecast", {
    method: "GET"
  });
}
