"use client";

import {
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  getWorkPlanContext,
  startDemoSession,
  type WorkPlanContextItem,
  type WorkPlanContextResponse
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BudgetPreset = "light" | "balanced" | "high";
type FocusPreset = "morning" | "afternoon" | "evening" | "late_night" | "no_preference";
type WorkStylePreset = "deep" | "medium" | "short";
type StartBehaviorPreset = "early" | "normal" | "last_minute";
type SplitPreset = "single" | "mix" | "balanced";
type BufferPreset = "high" | "medium" | "low";
type LoadPreset = "light" | "normal" | "heavy";
type ReminderPreset = "chill" | "normal" | "aggressive";

type PlannerProfile = {
  weekdayBudget: BudgetPreset | null;
  weekendBudget: BudgetPreset | null;
  preferredTime: FocusPreset | null;
  workStyle: WorkStylePreset | null;
  startBehavior: StartBehaviorPreset | null;
  splitPreference: SplitPreset | null;
  bufferPreference: BufferPreset | null;
  outsideLoad: LoadPreset | null;
  reminderAggressiveness: ReminderPreset | null;
};

type PlannerProfileResolved = {
  [K in keyof PlannerProfile]: Exclude<PlannerProfile[K], null>;
};

type ProfileKey = keyof PlannerProfile;
type RecomputeMode = "initial" | "session_skipped" | "workload_changed";
type SessionStatus = "pending" | "in_progress" | "completed" | "skipped";
type FrictionReason =
  | "too_tired"
  | "too_busy"
  | "did_not_know_where_to_start"
  | "task_too_big"
  | "none";

type WizardQuestion = {
  key: ProfileKey;
  optional?: boolean;
  prompt: string;
  options: Array<{
    value: string;
    label: string;
    hint: string;
  }>;
};

type PlannedSession = {
  id: string;
  itemId: string;
  courseName: string;
  title: string;
  goal: string;
  dateIso: string;
  dayLabel: string;
  startMinutes: number;
  startLabel: string;
  durationMinutes: number;
  leverageScore: number;
  riskReductionImpact: number;
  rationale: string;
  dependencies: string[];
  ifOnlyOneThing: string;
  taskUrl: string;
  submissionUrl: string;
  assignmentUrl: string;
  assignmentHref: string;
  contentLocator: WorkPlanContextItem["contentLocator"];
  checklistTasks: WorkPlanContextItem["checklistTasks"];
  dueAt: string;
  status: SessionStatus;
  overflowPlacement: boolean;
};

type PlannedDay = {
  dateIso: string;
  dayLabel: string;
  capacityMinutes: number;
  usedMinutes: number;
};

type GeneratedPlan = {
  generatedAt: string;
  mode: RecomputeMode;
  strategySummary: string;
  profileChips: string[];
  quality: {
    plannedHours: number;
    requiredHours: number;
    bufferAchievedPct: number;
    heavyWeekCoveragePct: number;
  };
  topTask: {
    itemId: string;
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
  days: PlannedDay[];
  sessions: PlannedSession[];
  diffLines: string[];
};

type BehaviorEvent = {
  sessionId: string;
  itemId: string;
  status: "completed" | "skipped";
  actualMinutes: number;
  frictionReason: FrictionReason;
  createdAt: string;
};

const PROFILE_STORAGE_KEY = "clarus.optimizer.profile.v3";
const BEHAVIOR_STORAGE_KEY = "clarus.optimizer.behavior.v3";

const defaultProfile: PlannerProfile = {
  weekdayBudget: null,
  weekendBudget: null,
  preferredTime: null,
  workStyle: null,
  startBehavior: null,
  splitPreference: null,
  bufferPreference: null,
  outsideLoad: null,
  reminderAggressiveness: null
};

const requiredProfileKeys: ProfileKey[] = [
  "weekdayBudget",
  "weekendBudget",
  "preferredTime",
  "workStyle",
  "startBehavior",
  "splitPreference",
  "bufferPreference",
  "outsideLoad"
];

const wizardQuestions: WizardQuestion[] = [
  {
    key: "weekdayBudget",
    prompt: "How much time can you commit most weekdays?",
    options: [
      { value: "light", label: "Light", hint: "≈ 1-1.5h/day" },
      { value: "balanced", label: "Balanced", hint: "≈ 2-3h/day" },
      { value: "high", label: "High", hint: "≈ 4h+/day" }
    ]
  },
  {
    key: "weekendBudget",
    prompt: "How much time can you commit on weekends?",
    options: [
      { value: "light", label: "Light", hint: "≈ 1-2h/day" },
      { value: "balanced", label: "Balanced", hint: "≈ 3-4h/day" },
      { value: "high", label: "High", hint: "≈ 5h+/day" }
    ]
  },
  {
    key: "preferredTime",
    prompt: "When do you usually focus best?",
    options: [
      { value: "morning", label: "Morning", hint: "6-11" },
      { value: "afternoon", label: "Afternoon", hint: "11-5" },
      { value: "evening", label: "Evening", hint: "5-10" },
      { value: "late_night", label: "Late night", hint: "10-2" },
      { value: "no_preference", label: "No preference", hint: "flexible" }
    ]
  },
  {
    key: "workStyle",
    prompt: "How do you prefer to work?",
    options: [
      { value: "deep", label: "Deep blocks", hint: "90-120 min" },
      { value: "medium", label: "Medium blocks", hint: "45-60 min" },
      { value: "short", label: "Short bursts", hint: "20-30 min" }
    ]
  },
  {
    key: "startBehavior",
    prompt: "When do you typically start bigger assignments?",
    options: [
      { value: "early", label: "Early starter", hint: "7+ days before" },
      { value: "normal", label: "Normal", hint: "3-6 days before" },
      { value: "last_minute", label: "Last-minute", hint: "within 48h" }
    ]
  },
  {
    key: "splitPreference",
    prompt: "One task at a time or mix tasks?",
    options: [
      { value: "single", label: "One at a time", hint: "finish then switch" },
      { value: "mix", label: "Mix tasks daily", hint: "interleave subjects" },
      { value: "balanced", label: "Balanced", hint: "a bit of both" }
    ]
  },
  {
    key: "bufferPreference",
    prompt: "How much buffer do you want before deadlines?",
    options: [
      { value: "high", label: "High buffer", hint: "finish 2+ days early" },
      { value: "medium", label: "Medium", hint: "finish 1 day early" },
      { value: "low", label: "Low", hint: "can finish day-of" }
    ]
  },
  {
    key: "outsideLoad",
    prompt: "How busy are you outside school this week?",
    options: [
      { value: "light", label: "Light", hint: "extra bandwidth" },
      { value: "normal", label: "Normal", hint: "usual load" },
      { value: "heavy", label: "Heavy", hint: "limited bandwidth" }
    ]
  },
  {
    key: "reminderAggressiveness",
    optional: true,
    prompt: "Reminder aggressiveness (optional)",
    options: [
      { value: "chill", label: "Chill", hint: "minimal nudges" },
      { value: "normal", label: "Normal", hint: "balanced" },
      { value: "aggressive", label: "Aggressive", hint: "frequent reminders" }
    ]
  }
];

export default function WorkPlanOptimizerPage() {
  const router = useRouter();
  const [context, setContext] = useState<WorkPlanContextResponse | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [hasHydratedLocalState, setHasHydratedLocalState] = useState(false);
  const [contextError, setContextError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [profile, setProfile] = useState<PlannerProfile>(defaultProfile);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(true);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionAdaptiveNote, setSessionAdaptiveNote] = useState("");
  const [actualMinutesChoice, setActualMinutesChoice] = useState<number | null>(null);
  const [frictionChoice, setFrictionChoice] = useState<FrictionReason>("none");
  const [behaviorEvents, setBehaviorEvents] = useState<BehaviorEvent[]>([]);

  const question = wizardQuestions[wizardStep];

  const answeredCount = wizardQuestions.filter((q) => profile[q.key] !== null).length;
  const requiredAnswered = requiredProfileKeys.every((key) => profile[key] !== null);

  const selectedDaySessions = useMemo(() => {
    if (!plan || !selectedDayIso) {
      return [];
    }

    return plan.sessions
      .filter((session) => session.dateIso === selectedDayIso)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, [plan, selectedDayIso]);

  const selectedDayTimeline = useMemo(() => {
    if (selectedDaySessions.length === 0) {
      return null;
    }

    const dayStart = Math.min(...selectedDaySessions.map((session) => session.startMinutes));
    const dayEnd = Math.max(
      ...selectedDaySessions.map((session) => session.startMinutes + session.durationMinutes)
    );
    const span = Math.max(60, dayEnd - dayStart);

    return {
      dayStart,
      dayEnd,
      span,
      segments: selectedDaySessions.map((session) => ({
        id: session.id,
        label: session.title.split(" - ").slice(-1)[0] ?? session.title,
        leftPct: ((session.startMinutes - dayStart) / span) * 100,
        widthPct: Math.max(10, (session.durationMinutes / span) * 100),
        timeLabel: `${session.startLabel} - ${formatTime(session.startMinutes + session.durationMinutes)}`
      }))
    };
  }, [selectedDaySessions]);

  const selectedSession = useMemo(
    () => plan?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [plan, selectedSessionId]
  );

  const activeSession = useMemo(
    () => plan?.sessions.find((session) => session.id === activeSessionId) ?? null,
    [plan, activeSessionId]
  );
  const getPrimaryStudyLink = useCallback((session: PlannedSession) => {
    const contentFirst = session.contentLocator.find((link) =>
      link.url.toLowerCase().includes("/d2l/le/content/")
    );
    return contentFirst ?? session.contentLocator[0] ?? null;
  }, []);
  const topTaskGuidance = useMemo(() => buildTopTaskGuidance(plan?.topTask ?? null), [plan?.topTask]);

  const loadContext = useCallback(async () => {
    setIsLoadingContext(true);
    setContextError(null);

    try {
      const payload = await getWorkPlanContext();
      setContext(payload);
    } catch (error) {
      setContext(null);

      if (error instanceof ApiError && error.code === "unauthorized") {
        setContextError({
          code: "unauthorized",
          message: "Sign in required. Your Clarus session is not active."
        });
      } else if (error instanceof ApiError && error.code === "not_connected") {
        setContextError({
          code: "not_connected",
          message: "No Brightspace connection found. Connect your D2L account first."
        });
      } else if (error instanceof ApiError && error.code === "session_expired") {
        setContextError({
          code: "session_expired",
          message: "Your Brightspace session expired. Reconnect and sync to load live course work."
        });
        toast.error("optimizer context unavailable", { description: "session expired" });
      } else {
        const detail = error instanceof Error ? error.message : "failed to load active D2L context";
        setContextError({
          code: "context_unavailable",
          message: detail
        });
        toast.error("optimizer context unavailable", { description: detail });
      }
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const savedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile) as PlannerProfile;
        setProfile((prev) => ({ ...prev, ...parsed }));
      }

      const savedBehavior = window.localStorage.getItem(BEHAVIOR_STORAGE_KEY);
      if (savedBehavior) {
        const parsedBehavior = JSON.parse(savedBehavior) as BehaviorEvent[];
        if (Array.isArray(parsedBehavior)) {
          setBehaviorEvents(parsedBehavior.slice(0, 100));
        }
      }
    } catch {
      // Keep defaults on malformed local data.
    } finally {
      setHasHydratedLocalState(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(behaviorEvents));
  }, [behaviorEvents]);

  useEffect(() => {
    if (!hasHydratedLocalState || isLoadingContext || contextError || !context || plan) {
      return;
    }

    if (!requiredAnswered || context.workItems.length === 0) {
      return;
    }

    const nextPlan = buildPlan({
      context,
      profile,
      mode: "initial",
      events: behaviorEvents,
      previousPlan: null
    });

    setPlan(nextPlan);
    setWizardOpen(false);

    const initialDay = nextPlan.days.find((day) =>
      nextPlan.sessions.some((session) => session.dateIso === day.dateIso)
    );
    setSelectedDayIso(initialDay?.dateIso ?? nextPlan.days[0]?.dateIso ?? null);
    setSelectedSessionId(nextPlan.sessions[0]?.id ?? null);
  }, [
    behaviorEvents,
    context,
    contextError,
    hasHydratedLocalState,
    isLoadingContext,
    plan,
    profile,
    requiredAnswered
  ]);

  function updateProfileValue(value: string) {
    setProfile((prev) => ({
      ...prev,
      [question.key]: value
    }));

    if (wizardStep < wizardQuestions.length - 1) {
      setWizardStep((prev) => prev + 1);
    }
  }

  function goBack() {
    setWizardStep((prev) => Math.max(0, prev - 1));
  }

  function goNext() {
    if (!question.optional && !profile[question.key]) {
      return;
    }
    setWizardStep((prev) => Math.min(wizardQuestions.length - 1, prev + 1));
  }

  function skipQuestion() {
    if (!question.optional) {
      return;
    }
    setProfile((prev) => ({ ...prev, [question.key]: null }));
    goNext();
  }

  async function generatePlan(mode: RecomputeMode) {
    if (!context) {
      toast.error("context not loaded");
      return;
    }

    if (!requiredAnswered) {
      toast.error("complete required setup questions first");
      return;
    }

    if (context.workItems.length === 0) {
      toast.error("no active work found in current courses");
      return;
    }

    setIsGenerating(true);
    try {
      const nextPlan = buildPlan({
        context,
        profile,
        mode,
        events: behaviorEvents,
        previousPlan: plan
      });

      setPlan(nextPlan);
      setWizardOpen(false);

      const initialDay = nextPlan.days.find((day) =>
        nextPlan.sessions.some((session) => session.dateIso === day.dateIso)
      );
      setSelectedDayIso(initialDay?.dateIso ?? nextPlan.days[0]?.dateIso ?? null);
      setSelectedSessionId(nextPlan.sessions[0]?.id ?? null);
      toast.success(
        mode === "initial"
          ? "plan generated"
          : mode === "session_skipped"
            ? "plan recomputed for skipped sessions"
            : "plan recomputed for workload changes"
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "failed to generate plan";
      toast.error("could not generate plan", { description: detail });
    } finally {
      setIsGenerating(false);
    }
  }

  function updateSessionStatus(sessionId: string, status: SessionStatus) {
    setPlan((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        sessions: prev.sessions.map((session) =>
          session.id === sessionId ? { ...session, status } : session
        )
      };
    });
  }

  async function simulateMissedSession() {
    if (!plan) {
      return;
    }

    const pending = plan.sessions.find((session) => session.status === "pending");
    if (!pending) {
      toast.message("no pending sessions to simulate");
      return;
    }

    setBehaviorEvents((prev) => [
      {
        sessionId: pending.id,
        itemId: pending.itemId,
        status: "skipped",
        actualMinutes: 0,
        frictionReason: "too_busy",
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
    updateSessionStatus(pending.id, "skipped");
    await generatePlan("session_skipped");
  }

  function openStartSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setActualMinutesChoice(null);
    setFrictionChoice("none");
    setSessionAdaptiveNote("");
  }

  function focusSessionDetails(sessionId: string) {
    setSelectedSessionId(sessionId);
    if (typeof document === "undefined") {
      return;
    }

    const detailsPanel = document.getElementById("session-details-panel");
    detailsPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function startSessionNow() {
    if (!activeSession || isStartingSession) {
      return;
    }

    setIsStartingSession(true);
    try {
      const started = await startDemoSession({
        assignmentId: activeSession.itemId,
        plannedMinutes: activeSession.durationMinutes
      });
      updateSessionStatus(activeSession.id, "in_progress");
      setSessionAdaptiveNote(started.adaptiveNote);
      toast.success("session started");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "failed to start";
      toast.error("session start failed", { description: detail });
    } finally {
      setIsStartingSession(false);
    }
  }

  function markSessionCompleted() {
    if (!activeSession) {
      return;
    }

    setBehaviorEvents((prev) => [
      {
        sessionId: activeSession.id,
        itemId: activeSession.itemId,
        status: "completed",
        actualMinutes: actualMinutesChoice ?? activeSession.durationMinutes,
        frictionReason: "none",
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
    updateSessionStatus(activeSession.id, "completed");
    setActiveSessionId(null);
    toast.success("session completed");
  }

  function markSessionSkipped() {
    if (!activeSession) {
      return;
    }

    setBehaviorEvents((prev) => [
      {
        sessionId: activeSession.id,
        itemId: activeSession.itemId,
        status: "skipped",
        actualMinutes: 0,
        frictionReason: frictionChoice,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
    updateSessionStatus(activeSession.id, "skipped");
    setActiveSessionId(null);
    toast.message("session skipped logged");
  }

  const profileSummary = summarizeProfile(profile);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>work plan optimizer</CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-time active-course planning from Brightspace assignments, deadlines, and content.
          </p>
        </CardHeader>
      </Card>

      {isLoadingContext ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isLoadingContext && contextError ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-4 w-4 text-destructive" />
              <p>{contextError.message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {contextError.code === "session_expired" ? (
                <Button size="sm" onClick={() => router.push("/login")}>
                  reconnect d2l
                </Button>
              ) : null}
              {contextError.code === "not_connected" ? (
                <Button size="sm" onClick={() => router.push("/login")}>
                  connect d2l
                </Button>
              ) : null}
              {contextError.code === "unauthorized" ? (
                <Button size="sm" onClick={() => router.push("/login")}>
                  sign in
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => void loadContext()}>
                retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!plan && !isLoadingContext && !contextError && !requiredAnswered ? (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card className="border-primary/30">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">quick setup wizard</CardTitle>
                <Badge variant="secondary">{answeredCount}/{wizardQuestions.length} answered</Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(answeredCount / wizardQuestions.length) * 100}%` }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-20">
              <div
                key={`${question.key}-${wizardStep}`}
                className="rounded-md border border-border/70 bg-card/70 p-4 animate-slide-in"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  question {wizardStep + 1} / {wizardQuestions.length}
                </p>
                <p className="mt-1 text-sm font-medium">{question.prompt}</p>
                <div className="mt-3 grid gap-2">
                  {question.options.map((option) => {
                    const selected = profile[question.key] === option.value;
                    return (
                      <button
                        key={`${question.key}-${option.value}`}
                        type="button"
                        onClick={() => updateProfileValue(option.value)}
                        className={cn(
                          "rounded-md border px-3 py-3 text-left transition-colors",
                          selected
                            ? "border-primary/60 bg-primary/10"
                            : "border-border/70 bg-secondary/20 hover:bg-secondary/30"
                        )}
                        aria-pressed={selected}
                      >
                        <p className="text-sm font-medium text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sticky bottom-0 rounded-md border border-border/70 bg-background/95 p-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={goBack} disabled={wizardStep === 0}>
                    back
                  </Button>
                  <Button
                    size="sm"
                    onClick={goNext}
                    disabled={wizardStep === wizardQuestions.length - 1 || (!question.optional && !profile[question.key])}
                  >
                    next
                  </Button>
                  <Button variant="ghost" size="sm" onClick={skipQuestion} disabled={!question.optional}>
                    skip
                  </Button>
                  <div className="ml-auto">
                    <Button onClick={() => void generatePlan("initial")} disabled={!requiredAnswered || isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      generate plan
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">profile summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <SummaryRow label="weekday budget" value={profileSummary.weekdayBudget} />
              <SummaryRow label="weekend budget" value={profileSummary.weekendBudget} />
              <SummaryRow label="preferred time" value={profileSummary.preferredTime} />
              <SummaryRow label="block length" value={profileSummary.blockLength} />
              <SummaryRow label="start style" value={profileSummary.startBehavior} />
              <SummaryRow label="split style" value={profileSummary.splitPreference} />
              <SummaryRow label="buffer" value={profileSummary.bufferPreference} />
              <SummaryRow label="outside load" value={profileSummary.outsideLoad} />
              <SummaryRow label="reminders" value={profileSummary.reminderAggressiveness} />
              <div className="mt-3 rounded-md border border-border/70 bg-secondary/20 p-2 text-xs">
                using {context?.activeCourses.length ?? 0} active courses and{" "}
                {context?.workItems.length ?? 0} active assessments from D2L.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!plan && !isLoadingContext && !contextError && requiredAnswered ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">preferences saved</p>
              <p className="text-sm text-muted-foreground">
                generating your plan with saved setup. You can edit preferences any time.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setWizardOpen(true)}>
                <Pencil className="h-4 w-4" />
                edit inputs
              </Button>
              <Button size="sm" onClick={() => void generatePlan("initial")} disabled={isGenerating || !context}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                generate now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {plan ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">this week&apos;s strategy</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setWizardOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    edit inputs
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void generatePlan("initial")} disabled={isGenerating}>
                    <RefreshCcw className="h-4 w-4" />
                    re-optimize
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void simulateMissedSession()} disabled={isGenerating}>
                    simulate missed session
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void generatePlan("workload_changed")} disabled={isGenerating}>
                    recompute workload change
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{plan.strategySummary}</p>
              <div className="flex flex-wrap gap-2">
                {plan.profileChips.map((chip) => (
                  <Badge key={chip} variant="secondary">
                    {chip}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border border-border/70 bg-secondary/20 p-3 text-muted-foreground">
                <p>
                  planned {plan.quality.plannedHours}h across {plan.sessions.length} focused sessions
                  (required {plan.quality.requiredHours}h).
                </p>
                <p>
                  buffer confidence:{" "}
                  {plan.quality.bufferAchievedPct >= 85
                    ? "strong"
                    : plan.quality.bufferAchievedPct >= 65
                      ? "acceptable"
                      : "tight"}{" "}
                  ({plan.quality.bufferAchievedPct}%).
                </p>
              </div>

              {plan.diffLines.length > 0 ? (
                <div className="rounded-md border border-border/70 bg-secondary/20 p-2 text-xs text-muted-foreground">
                  {plan.diffLines.map((line) => (
                    <p key={line}>- {line}</p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">weekly schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {plan.days.map((day) => {
                      const selected = selectedDayIso === day.dateIso;
                      return (
                        <button
                          key={day.dateIso}
                          type="button"
                          onClick={() => setSelectedDayIso(day.dateIso)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-left transition-colors",
                            selected
                              ? "border-primary/60 bg-primary/10"
                              : "border-border/70 bg-secondary/20 hover:bg-secondary/30"
                          )}
                        >
                          <p className="text-xs font-medium text-foreground">{day.dayLabel}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {day.usedMinutes}/{day.capacityMinutes}m
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDayTimeline ? (
                    <div className="rounded-md border border-border/70 bg-secondary/20 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatTime(selectedDayTimeline.dayStart)}</span>
                        <span>day timeline</span>
                        <span>{formatTime(selectedDayTimeline.dayEnd)}</span>
                      </div>
                      <div className="relative mt-2 h-14 rounded-md border border-border/60 bg-background/60">
                        {selectedDayTimeline.segments.map((segment) => (
                          <button
                            key={`timeline-${segment.id}`}
                            type="button"
                            onClick={() => focusSessionDetails(segment.id)}
                            className={cn(
                              "absolute top-2 h-10 overflow-hidden rounded-md border px-2 text-left text-[11px] leading-tight",
                              selectedSessionId === segment.id
                                ? "border-primary/70 bg-primary/20 text-foreground"
                                : "border-primary/40 bg-primary/10 text-foreground/90 hover:bg-primary/15"
                            )}
                            style={{
                              left: `${segment.leftPct}%`,
                              width: `${segment.widthPct}%`
                            }}
                            title={`${segment.label} · ${segment.timeLabel}`}
                          >
                            {segment.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Select a block to inspect details and start.
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {selectedDaySessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No blocks scheduled for this day.</p>
                    ) : (
                      selectedDaySessions.map((session) => {
                        const studyLink = getPrimaryStudyLink(session);
                        return (
                          <div
                            key={session.id}
                            className={cn(
                              "rounded-md border px-3 py-3",
                              selectedSessionId === session.id
                                ? "border-primary/60 bg-primary/10"
                                : "border-border/70 bg-secondary/20"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">{session.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {session.startLabel} - {formatTime(session.startMinutes + session.durationMinutes)} ·{" "}
                                  {session.durationMinutes}m
                                </p>
                              </div>
                              <Badge variant="secondary">{session.status}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => focusSessionDetails(session.id)}
                              >
                                details
                              </Button>
                              <a
                                href={session.taskUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                open task
                              </a>
                              <a
                                href={session.submissionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                open dropbox/rubric
                              </a>
                              {studyLink ? (
                                <a
                                  href={studyLink.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  where to study
                                </a>
                              ) : null}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="ml-auto h-7 text-xs"
                                onClick={() => openStartSession(session.id)}
                              >
                                <PlayCircle className="h-3 w-3" />
                                start
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card id="prioritization-engine">
                <CardHeader>
                  <CardTitle className="text-base">what to prioritize now</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {plan.topTask ? (
                    <>
                      <p className="font-medium text-foreground">{plan.topTask.title}</p>
                      <p className="text-muted-foreground">{topTaskGuidance.summary}</p>
                      <div className="space-y-1 rounded-md border border-border/70 bg-secondary/20 p-2 text-xs text-muted-foreground">
                        {topTaskGuidance.reasons.map((reason) => (
                          <p key={reason}>- {reason}</p>
                        ))}
                      </div>
                      <p className="text-muted-foreground">
                        if delayed 24h: focus quality and deadline margin will drop.
                      </p>
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                        next step: {topTaskGuidance.nextStep}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No top task available.</p>
                  )}
                </CardContent>
              </Card>

              <Card id="session-details-panel">
                <CardHeader>
                  <CardTitle className="text-base">session details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {selectedSession ? (
                    <>
                      <p className="font-medium text-foreground">{selectedSession.title}</p>
                      <p className="text-muted-foreground">why scheduled here: {selectedSession.rationale}</p>
                      <p className="text-muted-foreground">
                        dependencies: {selectedSession.dependencies.join(" -> ")}
                      </p>
                      <p className="text-muted-foreground">
                        if you only do one thing:{" "}
                        <span className="text-foreground">{selectedSession.ifOnlyOneThing}</span>
                      </p>
                      <div className="rounded-md border border-border/70 bg-secondary/20 p-2">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          content locator (top 3)
                        </p>
                        {selectedSession.contentLocator.slice(0, 3).map((resource, index) => (
                          <a
                            key={`${selectedSession.id}-${index}`}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-primary hover:underline"
                          >
                            #{index + 1} {resource.module} to {resource.lecture} ({resource.section})
                          </a>
                        ))}
                      </div>
                      <div className="rounded-md border border-border/70 bg-secondary/20 p-2">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          checklist tasks
                        </p>
                        {selectedSession.checklistTasks.slice(0, 5).map((task) => (
                          <p key={`${selectedSession.id}-${task.id}`} className="text-xs text-muted-foreground">
                            - {task.text}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Select a session to see rationale and evidence.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      ) : null}

      {plan && wizardOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">edit inputs</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setWizardOpen(false)}>
                  close
                </Button>
                <Button size="sm" onClick={() => void generatePlan("initial")} disabled={!requiredAnswered || isGenerating}>
                  re-generate
                </Button>
              </div>
            </div>
            <Card className="border-primary/30">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">quick setup wizard</CardTitle>
                  <Badge variant="secondary">{answeredCount}/{wizardQuestions.length} answered</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(answeredCount / wizardQuestions.length) * 100}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div key={`${question.key}-modal-${wizardStep}`} className="rounded-md border border-border/70 bg-card/70 p-4 animate-slide-in">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    question {wizardStep + 1} / {wizardQuestions.length}
                  </p>
                  <p className="mt-1 text-sm font-medium">{question.prompt}</p>
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => (
                      <button
                        key={`${question.key}-modal-${option.value}`}
                        type="button"
                        onClick={() => updateProfileValue(option.value)}
                        className={cn(
                          "rounded-md border px-3 py-3 text-left transition-colors",
                          profile[question.key] === option.value
                            ? "border-primary/60 bg-primary/10"
                            : "border-border/70 bg-secondary/20 hover:bg-secondary/30"
                        )}
                        aria-pressed={profile[question.key] === option.value}
                      >
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={goBack} disabled={wizardStep === 0}>
                    back
                  </Button>
                  <Button size="sm" onClick={goNext} disabled={wizardStep === wizardQuestions.length - 1}>
                    next
                  </Button>
                  <Button variant="ghost" size="sm" onClick={skipQuestion} disabled={!question.optional}>
                    skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeSession ? (
        <div className="fixed inset-0 z-50 bg-black/45">
          <div className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-background p-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">start session</p>
                  <h3 className="text-lg font-semibold">{activeSession.title}</h3>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setActiveSessionId(null)}>
                  close
                </Button>
              </div>

              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <p>
                    <Clock3 className="mr-1 inline h-4 w-4" />
                    {activeSession.durationMinutes} min planned
                  </p>
                  <p className="text-muted-foreground">goal: {activeSession.goal}</p>
                  <p className="text-muted-foreground">
                    where to start: {getPrimaryStudyLink(activeSession)?.module ?? "course content"} to{" "}
                    {getPrimaryStudyLink(activeSession)?.lecture ?? "relevant lecture"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void startSessionNow()} disabled={isStartingSession}>
                      {isStartingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      start session
                    </Button>
                    <Button variant="secondary" onClick={markSessionCompleted}>
                      <CheckCircle2 className="h-4 w-4" />
                      mark completed
                    </Button>
                    <Button variant="secondary" onClick={markSessionSkipped}>
                      <TriangleAlert className="h-4 w-4" />
                      mark skipped
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">session log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide">actual time spent</p>
                    <div className="flex flex-wrap gap-2">
                      {[20, 30, 45, 60, 90, 120].map((minutes) => (
                        <button
                          key={`${activeSession.id}-${minutes}`}
                          type="button"
                          onClick={() => setActualMinutesChoice(minutes)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs",
                            actualMinutesChoice === minutes
                              ? "border-primary/60 bg-primary/10 text-foreground"
                              : "border-border/70 bg-secondary/20"
                          )}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide">if skipped, why?</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "too_tired", label: "too tired" },
                        { value: "too_busy", label: "too busy" },
                        { value: "did_not_know_where_to_start", label: "didn't know where to start" },
                        { value: "task_too_big", label: "task too big" }
                      ].map((option) => (
                        <button
                          key={`${activeSession.id}-${option.value}`}
                          type="button"
                          onClick={() => setFrictionChoice(option.value as FrictionReason)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs",
                            frictionChoice === option.value
                              ? "border-primary/60 bg-primary/10 text-foreground"
                              : "border-border/70 bg-secondary/20"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sessionAdaptiveNote ? (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                      {sessionAdaptiveNote}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoadingContext && !contextError && context && context.workItems.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No active assignments were found in currently active courses. Sync courses and verify D2L course activity/due dates.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function summarizeProfile(profile: PlannerProfile): Record<string, string> {
  return {
    weekdayBudget: prettyValue(profile.weekdayBudget),
    weekendBudget: prettyValue(profile.weekendBudget),
    preferredTime: prettyValue(profile.preferredTime),
    blockLength:
      profile.workStyle === "deep"
        ? "90-120 min"
        : profile.workStyle === "short"
          ? "20-30 min"
          : profile.workStyle === "medium"
            ? "45-60 min"
            : "not set",
    startBehavior: prettyValue(profile.startBehavior),
    splitPreference: prettyValue(profile.splitPreference),
    bufferPreference: prettyValue(profile.bufferPreference),
    outsideLoad: prettyValue(profile.outsideLoad),
    reminderAggressiveness: prettyValue(profile.reminderAggressiveness)
  };
}

function prettyValue(value: string | null): string {
  return value ? value.replace(/_/g, " ") : "not set";
}

function buildTopTaskGuidance(topTask: GeneratedPlan["topTask"]): {
  summary: string;
  reasons: string[];
  nextStep: string;
} {
  if (!topTask) {
    return {
      summary: "No top task is currently available.",
      reasons: [],
      nextStep: "Sync courses and refresh context."
    };
  }

  const reasons: string[] = [];
  if (topTask.scoreBreakdown.deadlineProximity >= 14) {
    reasons.push("Due date pressure is high, so delaying increases deadline risk.");
  }
  if (topTask.scoreBreakdown.risk >= 12) {
    reasons.push("Risk model predicts this item is likely to slip without early action.");
  }
  if (topTask.scoreBreakdown.gradeWeight >= 6) {
    reasons.push("This task has meaningful grade impact compared with other active work.");
  }
  if (topTask.scoreBreakdown.complexity >= 8 || topTask.scoreBreakdown.effort >= 6) {
    reasons.push("This is a deep task and needs multiple focused sessions.");
  }

  if (reasons.length === 0) {
    reasons.push("Weighted ranking still places this as the highest-leverage task now.");
  }

  return {
    summary: topTask.reason,
    reasons,
    nextStep: "Open the task, review the first checklist item, and start one focused session now."
  };
}

function buildPlan(input: {
  context: WorkPlanContextResponse;
  profile: PlannerProfile;
  mode: RecomputeMode;
  events: BehaviorEvent[];
  previousPlan: GeneratedPlan | null;
}): GeneratedPlan {
  const profile = resolveProfile(input.profile, input.mode, input.events);
  const now = new Date();
  const blockMinutes = getBlockMinutes(profile.workStyle);
  const breakMinutes = getBreakMinutes(profile.workStyle);
  const weekDays = createWeekDays(profile, now);
  const rankedItems = rankItemsForPlanning(input.context.workItems, now)
    .slice(0, 12)
    .map((entry) => entry.item);

  const requiredMinutesTotal = rankedItems.reduce((sum, item) => {
    const adjusted = adjustRequiredMinutes(item.estimatedMinutes, profile, input.mode);
    return sum + adjusted;
  }, 0);

  const sessionDrafts = rankedItems.flatMap((item) =>
    buildSessionDraftsForItem({
      item,
      now,
      profile,
      mode: input.mode,
      blockMinutes
    })
  );

  const scheduledSessions = placeSessionsIntoWeek({
    drafts: sessionDrafts,
    weekDays,
    profile,
    breakMinutes
  });

  const previousStatuses = new Map(
    (input.previousPlan?.sessions ?? []).map((session) => [session.id, session.status] as const)
  );

  const sessionsWithStatus = scheduledSessions.map((session) => ({
    ...session,
    status: previousStatuses.get(session.id) ?? "pending"
  }));

  const topTask = pickTopTask(input.context, rankedItems);
  const plannedMinutesTotal = sessionsWithStatus.reduce((sum, session) => sum + session.durationMinutes, 0);
  const quality = computePlanQuality({
    sessions: sessionsWithStatus,
    requiredMinutesTotal,
    profile
  });

  const strategySummary = buildStrategySummary({
    items: rankedItems,
    profile,
    mode: input.mode,
    quality
  });

  const diffLines =
    input.previousPlan && input.previousPlan.sessions.length > 0
      ? computeDiff(input.previousPlan.sessions, sessionsWithStatus)
      : [];

  return {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    strategySummary,
    profileChips: [
      `${profile.weekdayBudget} weekday time`,
      `${profile.weekendBudget} weekend time`,
      `${profile.preferredTime.replace(/_/g, " ")} focus`,
      `${getBlockMinutes(profile.workStyle)}-min blocks`,
      `${profile.bufferPreference} buffer`
    ],
    quality: {
      plannedHours: round2(plannedMinutesTotal / 60),
      requiredHours: round2(requiredMinutesTotal / 60),
      bufferAchievedPct: quality.bufferAchievedPct,
      heavyWeekCoveragePct: quality.heavyWeekCoveragePct
    },
    topTask,
    days: weekDays.map((day) => ({
      dateIso: day.dateIso,
      dayLabel: day.dayLabel,
      capacityMinutes: day.capacityMinutes,
      usedMinutes: day.usedMinutes
    })),
    sessions: sessionsWithStatus,
    diffLines
  };
}

function resolveProfile(
  profile: PlannerProfile,
  mode: RecomputeMode,
  events: BehaviorEvent[]
): PlannerProfileResolved {
  const resolved: PlannerProfileResolved = {
    weekdayBudget: profile.weekdayBudget ?? "balanced",
    weekendBudget: profile.weekendBudget ?? "balanced",
    preferredTime: profile.preferredTime ?? "evening",
    workStyle: profile.workStyle ?? "medium",
    startBehavior: profile.startBehavior ?? "normal",
    splitPreference: profile.splitPreference ?? "balanced",
    bufferPreference: profile.bufferPreference ?? "medium",
    outsideLoad: profile.outsideLoad ?? "normal",
    reminderAggressiveness: profile.reminderAggressiveness ?? "normal"
  };

  if (mode !== "session_skipped") {
    return resolved;
  }

  const recentSkips = events.filter((event) => event.status === "skipped").slice(0, 6).length;
  if (recentSkips < 2) {
    return resolved;
  }

  return {
    ...resolved,
    workStyle:
      resolved.workStyle === "deep"
        ? "medium"
        : resolved.workStyle === "medium"
          ? "short"
          : "short",
    preferredTime:
      resolved.preferredTime === "late_night"
        ? "evening"
        : resolved.preferredTime === "evening"
          ? "afternoon"
          : resolved.preferredTime
  };
}

function createWeekDays(profile: PlannerProfileResolved, now: Date) {
  const monday = startOfMonday(now);
  const loadFactor = profile.outsideLoad === "heavy" ? 0.75 : profile.outsideLoad === "light" ? 1.1 : 1;
  const weekdayBase = profile.weekdayBudget === "light" ? 90 : profile.weekdayBudget === "high" ? 255 : 170;
  const weekendBase = profile.weekendBudget === "light" ? 120 : profile.weekendBudget === "high" ? 320 : 220;

  return Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(monday, index);
    const isWeekend = index >= 5;
    const base = isWeekend ? weekendBase : weekdayBase;
    const capacity = Math.max(40, Math.round(base * loadFactor));

    return {
      dateIso: toIsoDate(date),
      dayLabel: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] ?? "Day",
      capacityMinutes: capacity,
      usedMinutes: 0,
      remainingMinutes: capacity,
      startMinute: focusStartMinute(profile.preferredTime),
      deepCount: 0
    };
  });
}

function buildSessionDraftsForItem(input: {
  item: WorkPlanContextItem;
  now: Date;
  profile: PlannerProfileResolved;
  mode: RecomputeMode;
  blockMinutes: number;
}) {
  const { item, now, profile, mode, blockMinutes } = input;
  const requiredMinutes = adjustRequiredMinutes(item.estimatedMinutes, profile, mode);
  const phaseLabels = getPhaseLabels(item.type, requiredMinutes);
  const sessionsNeeded = phaseLabels.length;
  const phaseDurations = distributeMinutesAcrossPhases(requiredMinutes, sessionsNeeded, blockMinutes);
  const earliest = earliestStartDate(item, profile, sessionsNeeded, now);
  const bufferDays = profile.bufferPreference === "high" ? 2 : profile.bufferPreference === "medium" ? 1 : 0;
  const latest = addDays(new Date(item.dueAt), -bufferDays);
  const drafts: Array<{
    id: string;
    itemId: string;
    courseName: string;
    title: string;
    goal: string;
    durationMinutes: number;
    earliestIso: string;
    latestIso: string;
    leverageScore: number;
    riskReductionImpact: number;
    rationale: string;
    dependencies: string[];
    ifOnlyOneThing: string;
    taskUrl: string;
    submissionUrl: string;
    assignmentUrl: string;
    assignmentHref: string;
    contentLocator: WorkPlanContextItem["contentLocator"];
    checklistTasks: WorkPlanContextItem["checklistTasks"];
    dueAt: string;
    isDeep: boolean;
  }> = [];

  if (mode === "workload_changed" && item.recentlyChanged) {
    drafts.push({
      id: `${item.id}-changes`,
      itemId: item.id,
      courseName: item.courseName,
      title: `${item.title} - review changes`,
      goal: "Validate recent updates in instructions and constraints.",
      durationMinutes: 20,
      earliestIso: toIsoDate(earliest),
      latestIso: toIsoDate(addDays(latest, -1)),
      leverageScore: round2(item.priorityScore + 9),
      riskReductionImpact: 8,
      rationale: "Recently changed item gets a dedicated review block.",
      dependencies: ["updated course page"],
      ifOnlyOneThing: "Review all changed requirements before deep work.",
      taskUrl: item.taskUrl ?? item.assignmentUrl,
      submissionUrl: item.submissionUrl ?? item.assignmentUrl,
      assignmentUrl: item.assignmentUrl,
      assignmentHref: `/dashboard/assignments/${item.id}`,
      contentLocator: item.contentLocator,
      checklistTasks: item.checklistTasks,
      dueAt: item.dueAt,
      isDeep: false
    });
  }

  for (let i = 0; i < sessionsNeeded; i += 1) {
    const phase = phaseLabels[i] ?? `Step ${i + 1}`;
    const goal = item.checklistTasks[i]?.text ?? defaultGoalForPhase(phase, i === sessionsNeeded - 1);
    const duration = Math.max(20, phaseDurations[i] ?? Math.round(requiredMinutes / sessionsNeeded));
    const proximityBoost = i === 0 ? 6 : i === sessionsNeeded - 1 ? 4 : 2;

    drafts.push({
      id: `${item.id}-s${i + 1}`,
      itemId: item.id,
      courseName: item.courseName,
      title: `${item.title} - ${phase}`,
      goal,
      durationMinutes: duration,
      earliestIso: toIsoDate(earliest),
      latestIso: toIsoDate(latest),
      leverageScore: round2(item.priorityScore + proximityBoost),
      riskReductionImpact: Math.max(4, Math.round(item.priorityScore / 8)),
      rationale:
        i === 0
          ? "Scheduled early to reduce downstream risk and keep buffer."
          : i === sessionsNeeded - 1
            ? "Final pass aligns with your selected deadline buffer."
            : "Sequenced for steady progress across the week.",
      dependencies: [`${item.contentLocator[0]?.lecture ?? "course lecture"} before drafting`],
      ifOnlyOneThing: item.checklistTasks[0]?.text ?? "Start with the highest-impact checklist item.",
      taskUrl: item.taskUrl ?? item.assignmentUrl,
      submissionUrl: item.submissionUrl ?? item.assignmentUrl,
      assignmentUrl: item.assignmentUrl,
      assignmentHref: `/dashboard/assignments/${item.id}`,
      contentLocator: item.contentLocator,
      checklistTasks: item.checklistTasks,
      dueAt: item.dueAt,
      isDeep: duration >= 75
    });
  }

  return drafts;
}

function placeSessionsIntoWeek(input: {
  drafts: ReturnType<typeof buildSessionDraftsForItem>;
  weekDays: ReturnType<typeof createWeekDays>;
  profile: PlannerProfileResolved;
  breakMinutes: number;
}): PlannedSession[] {
  const week = input.weekDays.map((day) => ({ ...day }));
  const drafts = sortDrafts(input.drafts, input.profile.splitPreference);
  const sessions: PlannedSession[] = [];

  drafts.forEach((draft) => {
    const earliest = new Date(draft.earliestIso);
    const latest = new Date(draft.latestIso);
    const candidate = week.filter((day) => {
      const date = new Date(day.dateIso);
      return date >= earliest && date <= latest;
    });
    const pool = candidate.length > 0 ? candidate : week;
    let filtered = pool.filter((day) => day.remainingMinutes >= draft.durationMinutes);
    if (filtered.length === 0) {
      filtered = pool;
    }

    if (draft.isDeep) {
      const lowDeep = filtered.filter((day) => day.deepCount === 0);
      if (lowDeep.length > 0) {
        filtered = lowDeep;
      }
    }

    filtered.sort((a, b) => {
      const d = new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime();
      if (d !== 0) {
        return d;
      }
      return b.remainingMinutes - a.remainingMinutes;
    });

    const chosen = filtered[0] ?? week[0];
    const overflowPlacement = chosen.remainingMinutes < draft.durationMinutes;
    const startMinutes = chosen.startMinute + chosen.usedMinutes;
    chosen.usedMinutes += draft.durationMinutes + input.breakMinutes;
    chosen.remainingMinutes = Math.max(0, chosen.capacityMinutes - chosen.usedMinutes);
    chosen.deepCount += draft.isDeep ? 1 : 0;

    sessions.push({
      id: draft.id,
      itemId: draft.itemId,
      courseName: draft.courseName,
      title: draft.title,
      goal: draft.goal,
      dateIso: chosen.dateIso,
      dayLabel: chosen.dayLabel,
      startMinutes,
      startLabel: formatTime(startMinutes),
      durationMinutes: draft.durationMinutes,
      leverageScore: draft.leverageScore,
      riskReductionImpact: draft.riskReductionImpact,
      rationale: draft.rationale,
      dependencies: draft.dependencies,
      ifOnlyOneThing: draft.ifOnlyOneThing,
      taskUrl: draft.taskUrl,
      submissionUrl: draft.submissionUrl,
      assignmentUrl: draft.assignmentUrl,
      assignmentHref: draft.assignmentHref,
      contentLocator: draft.contentLocator,
      checklistTasks: draft.checklistTasks,
      dueAt: draft.dueAt,
      status: "pending",
      overflowPlacement
    });
  });

  return sessions.sort((a, b) => {
    const d = new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime();
    if (d !== 0) {
      return d;
    }
    return a.startMinutes - b.startMinutes;
  });
}

function sortDrafts(
  drafts: ReturnType<typeof buildSessionDraftsForItem>,
  splitPreference: SplitPreset
) {
  const sorted = drafts
    .slice()
    .sort((a, b) => {
      const dueA = new Date(a.dueAt).getTime();
      const dueB = new Date(b.dueAt).getTime();
      if (dueA !== dueB) {
        return dueA - dueB;
      }
      const latestA = new Date(a.latestIso).getTime();
      const latestB = new Date(b.latestIso).getTime();
      if (latestA !== latestB) {
        return latestA - latestB;
      }
      return b.leverageScore - a.leverageScore;
    });

  if (splitPreference === "single") {
    const grouped = new Map<string, typeof sorted>();
    sorted.forEach((draft) => {
      const list = grouped.get(draft.itemId) ?? [];
      list.push(draft);
      grouped.set(draft.itemId, list);
    });
    const flattened: typeof sorted = [];
    grouped.forEach((group) => {
      group.sort((a, b) => draftPhaseOrder(a.id) - draftPhaseOrder(b.id));
      flattened.push(...group);
    });
    return flattened;
  }

  if (splitPreference === "mix") {
    const map = new Map<string, typeof sorted>();
    sorted.forEach((draft) => {
      const list = map.get(draft.itemId) ?? [];
      list.push(draft);
      map.set(draft.itemId, list);
    });
    map.forEach((group) => {
      group.sort((a, b) => draftPhaseOrder(a.id) - draftPhaseOrder(b.id));
    });
    const mixed: typeof sorted = [];
    while ([...map.values()].some((list) => list.length > 0)) {
      [...map.keys()].forEach((key) => {
        const next = map.get(key)?.shift();
        if (next) {
          mixed.push(next);
        }
      });
    }
    return mixed;
  }

  return sorted;
}

function computePlanQuality(input: {
  sessions: PlannedSession[];
  requiredMinutesTotal: number;
  profile: PlannerProfileResolved;
}) {
  const bufferDays =
    input.profile.bufferPreference === "high"
      ? 2
      : input.profile.bufferPreference === "medium"
        ? 1
        : 0;

  const bufferHits = input.sessions.filter((session) => {
    const bufferedDue = addDays(new Date(session.dueAt), -bufferDays);
    return new Date(session.dateIso) <= bufferedDue;
  }).length;
  const bufferAchievedPct =
    input.sessions.length === 0 ? 100 : Math.round((bufferHits / input.sessions.length) * 100);

  const highLeverage = input.sessions.filter((session) => session.leverageScore >= 75);
  const earlyHits = highLeverage.filter((session) => {
    const day = new Date(session.dateIso).getDay();
    return day === 1 || day === 2 || day === 3 || day === 4;
  }).length;
  const heavyWeekCoveragePct =
    highLeverage.length === 0 ? 100 : Math.round((earlyHits / highLeverage.length) * 100);

  return {
    bufferAchievedPct,
    heavyWeekCoveragePct,
    requiredMinutesTotal: input.requiredMinutesTotal
  };
}

function pickTopTask(context: WorkPlanContextResponse, rankedItems: WorkPlanContextItem[]) {
  const top = rankedItems[0];
  if (top) {
    return {
      itemId: top.id,
      title: top.title,
      courseName: top.courseName,
      priorityScore: top.priorityScore,
      delayImpactIfDeferred24h: top.delayImpactIfDeferred24h,
      scoreBreakdown: top.priorityBreakdown,
      reason: "Ranked highest after due-date urgency gating, then risk, weight, complexity, effort, and gap impact."
    };
  }

  const fromContext = context.highestLeverageTask;
  if (fromContext) {
    return {
      itemId: fromContext.id,
      title: fromContext.title,
      courseName: fromContext.courseName,
      priorityScore: fromContext.priorityScore,
      delayImpactIfDeferred24h: fromContext.delayImpactIfDeferred24h,
      scoreBreakdown: fromContext.scoreBreakdown,
      reason: fromContext.reason
    };
  }

  return null;
}

function buildStrategySummary(input: {
  items: WorkPlanContextItem[];
  profile: PlannerProfileResolved;
  mode: RecomputeMode;
  quality: { bufferAchievedPct: number; heavyWeekCoveragePct: number };
}) {
  const top = input.items[0];
  const heavy = input.quality.heavyWeekCoveragePct < 70;

  const lead = heavy
    ? `Heavy week detected. We front-loaded ${top?.title ?? "high leverage work"} to protect deadlines and risk.`
    : `Balanced week. ${top?.title ?? "Top leverage item"} is scheduled first based on weighted priority.`;

  const tail =
    input.mode === "session_skipped"
      ? "Skipped-session adaptation applied by shrinking blocks and pulling key work earlier."
      : input.mode === "workload_changed"
        ? "Workload-change adaptation inserted review-change sessions and re-ranked priorities."
        : "Plan is sequenced to match your preferred block style and buffer preference.";

  return `${lead} ${tail}`;
}

function computeDiff(previous: PlannedSession[], next: PlannedSession[]): string[] {
  const previousMap = new Map(previous.map((session) => [session.id, session] as const));
  const nextMap = new Map(next.map((session) => [session.id, session] as const));
  let moved = 0;
  let added = 0;
  let removed = 0;

  next.forEach((session) => {
    const old = previousMap.get(session.id);
    if (!old) {
      added += 1;
      return;
    }
    if (old.dateIso !== session.dateIso || old.startMinutes !== session.startMinutes) {
      moved += 1;
    }
  });

  previous.forEach((session) => {
    if (!nextMap.has(session.id)) {
      removed += 1;
    }
  });

  const lines: string[] = [];
  if (added > 0) {
    lines.push(`${added} session(s) added`);
  }
  if (removed > 0) {
    lines.push(`${removed} session(s) removed`);
  }
  if (moved > 0) {
    lines.push(`${moved} session(s) moved`);
  }
  if (lines.length === 0) {
    lines.push("No structural schedule changes.");
  }

  return lines;
}

function adjustRequiredMinutes(
  baseMinutes: number,
  profile: PlannerProfileResolved,
  mode: RecomputeMode
) {
  const loadFactor =
    profile.outsideLoad === "heavy" ? 1.2 : profile.outsideLoad === "light" ? 0.92 : 1;
  const startFactor =
    profile.startBehavior === "last_minute"
      ? 1.08
      : profile.startBehavior === "early"
        ? 0.95
        : 1;
  const modeFactor = mode === "workload_changed" ? 1.06 : mode === "session_skipped" ? 1.08 : 1;

  return Math.max(20, Math.round(baseMinutes * loadFactor * startFactor * modeFactor));
}

function rankItemsForPlanning(items: WorkPlanContextItem[], now: Date) {
  const nowMs = now.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return items
    .map((item) => {
      const dueAtMs = new Date(item.dueAt).getTime();
      const safeDueAtMs = Number.isNaN(dueAtMs) ? nowMs + dayMs * 365 : dueAtMs;
      const daysUntilDue = Math.max(0, Math.ceil((safeDueAtMs - nowMs) / dayMs));
      const urgencyBand = daysUntilDue <= 1 ? 0 : daysUntilDue <= 3 ? 1 : daysUntilDue <= 7 ? 2 : 3;
      const urgencyBoost = clamp(36 - daysUntilDue * 3, 0, 36);
      const recencyBoost = item.recentlyChanged ? 4 : 0;
      const planningScore = round2(
        item.priorityScore + urgencyBoost + recencyBoost + item.riskScore * 0.05 + item.gradeWeight * 0.04
      );

      return {
        item,
        daysUntilDue,
        urgencyBand,
        dueAtMs: safeDueAtMs,
        planningScore
      };
    })
    .sort((a, b) => {
      if (a.urgencyBand !== b.urgencyBand) {
        return a.urgencyBand - b.urgencyBand;
      }
      if (a.daysUntilDue !== b.daysUntilDue) {
        return a.daysUntilDue - b.daysUntilDue;
      }
      if (b.planningScore !== a.planningScore) {
        return b.planningScore - a.planningScore;
      }
      if (a.dueAtMs !== b.dueAtMs) {
        return a.dueAtMs - b.dueAtMs;
      }
      return a.item.title.localeCompare(b.item.title);
    });
}

function earliestStartDate(
  item: WorkPlanContextItem,
  profile: PlannerProfileResolved,
  sessionsNeeded: number,
  now: Date
) {
  const due = new Date(item.dueAt);
  const startLead =
    profile.startBehavior === "early"
      ? 7
      : profile.startBehavior === "normal"
        ? 4
        : 2;
  const lookback = startLead + Math.ceil(sessionsNeeded / 2);
  const candidate = addDays(due, -lookback);
  return candidate > now ? candidate : now;
}

function getPhaseLabels(type: WorkPlanContextItem["type"], requiredMinutes: number): string[] {
  if (type === "quiz") {
    return requiredMinutes <= 75
      ? ["Review", "Timed rehearsal"]
      : ["Review", "Practice", "Timed rehearsal"];
  }

  if (type === "discussion") {
    return requiredMinutes <= 80
      ? ["Read prompt", "Finalize post"]
      : ["Read prompt", "Draft response", "Finalize post"];
  }

  if (requiredMinutes <= 90) {
    return ["Scope", "Finalize"];
  }

  if (requiredMinutes <= 180) {
    return ["Scope", "Draft", "Finalize"];
  }

  return ["Scope", "Draft", "Revise", "Finalize"];
}

function distributeMinutesAcrossPhases(
  requiredMinutes: number,
  phaseCount: number,
  blockMinutes: number
): number[] {
  if (phaseCount <= 0) {
    return [];
  }

  const minPerPhase = Math.max(20, Math.round(blockMinutes * 0.6));
  const maxPerPhase = 210;
  const total = Math.max(requiredMinutes, minPerPhase * phaseCount);

  let durations = new Array(phaseCount).fill(minPerPhase);

  if (requiredMinutes <= minPerPhase * phaseCount) {
    const even = Math.max(20, Math.floor(requiredMinutes / phaseCount));
    durations = new Array(phaseCount).fill(even);
    let remainder = Math.max(0, requiredMinutes - even * phaseCount);
    let index = 0;
    while (remainder > 0) {
      durations[index] += 1;
      remainder -= 1;
      index = (index + 1) % phaseCount;
    }
    return durations;
  }

  let remaining = total - minPerPhase * phaseCount;
  let index = 0;

  while (remaining > 0) {
    const room = maxPerPhase - durations[index];
    if (room > 0) {
      const chunk = Math.min(room, remaining, Math.max(15, Math.round(blockMinutes * 0.7)));
      durations[index] += chunk;
      remaining -= chunk;
    }

    index = (index + 1) % phaseCount;

    if (index === 0 && durations.every((value) => value >= maxPerPhase)) {
      break;
    }
  }

  if (remaining > 0) {
    durations[phaseCount - 1] += remaining;
  }

  return durations.map((value) => Math.max(20, Math.round(value)));
}

function defaultGoalForPhase(phase: string, isFinal: boolean): string {
  if (isFinal || phase.toLowerCase().includes("final")) {
    return "Finalize and complete submission checks.";
  }

  if (phase.toLowerCase().includes("review")) {
    return "Review core materials and identify weak spots.";
  }

  if (phase.toLowerCase().includes("draft")) {
    return "Build the main draft and align it with checklist requirements.";
  }

  if (phase.toLowerCase().includes("scope") || phase.toLowerCase().includes("read")) {
    return "Confirm requirements and define a clear execution outline.";
  }

  return "Advance the task toward completion.";
}

function draftPhaseOrder(id: string): number {
  if (id.endsWith("-changes")) {
    return 0;
  }
  const match = id.match(/-s(\d+)$/);
  if (!match) {
    return 99;
  }
  return Number.parseInt(match[1] ?? "99", 10);
}

function getBlockMinutes(style: WorkStylePreset): number {
  if (style === "deep") {
    return 100;
  }
  if (style === "short") {
    return 25;
  }
  return 55;
}

function getBreakMinutes(style: WorkStylePreset): number {
  if (style === "deep") {
    return 12;
  }
  if (style === "short") {
    return 5;
  }
  return 8;
}

function focusStartMinute(focus: FocusPreset) {
  if (focus === "morning") {
    return 7 * 60;
  }
  if (focus === "afternoon") {
    return 12 * 60;
  }
  if (focus === "late_night") {
    return 22 * 60;
  }
  if (focus === "no_preference") {
    return 14 * 60;
  }
  return 17 * 60;
}

function startOfMonday(input: Date): Date {
  const date = new Date(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(minutesFromStart: number) {
  const minutes = ((minutesFromStart % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
