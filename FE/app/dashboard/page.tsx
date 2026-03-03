"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  type LucideIcon,
  ListTodo,
  Target
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  getCalendarEvents,
  getCourses,
  getD2LStatus,
  getWorkPlanContext,
  getWorkloadForecast,
  syncCourses,
  type Course,
  type TimelineEventDTO,
  type WorkPlanContextItem,
  type WorkPlanContextResponse,
  type WorkloadForecastData
} from "@/lib/api";
import { CourseList } from "@/components/courses/CourseList";
import { CourseSkeleton } from "@/components/courses/CourseSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildOverviewHref, deduplicateBySource } from "@/lib/upcomingUtils";

type ConnectionState = "loading" | "connected" | "expired" | "disconnected";

function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function severityLabel(score: number): "low" | "moderate" | "high" {
  if (score >= 70) return "high";
  if (score >= 55) return "moderate";
  return "low";
}

function workloadSeverityGuidance(severity: WorkloadForecastData["weeks"][number]["severity"]): string {
  switch (severity) {
    case "critical":
      return "Capacity is over limit. Front-load work and protect buffer time.";
    case "heavy":
      return "This week is heavy. Start earlier and split larger tasks.";
    case "moderate":
      return "Workload is manageable with consistent daily progress.";
    default:
      return "Light load week. Keep momentum and pre-work upcoming deadlines.";
  }
}

function dueInDaysText(dueAt: string): string {
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return "due date unavailable";
  }

  const now = Date.now();
  const days = Math.ceil((dueMs - now) / (1000 * 60 * 60 * 24));

  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

function startCase(text: string): string {
  if (!text) return text;
  return `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;
}

function OverviewCardTitle(props: {
  icon: LucideIcon;
  title: string;
  iconClassName?: string;
}) {
  const Icon = props.icon;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-secondary/45 ${props.iconClassName ?? ""}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <CardTitle className="text-base leading-snug">{props.title}</CardTitle>
    </div>
  );
}

function buildRiskCopy(topTask: WorkPlanContextItem | null, allItems: WorkPlanContextItem[]): {
  title: string;
  summary: string;
  actions: string[];
} {
  if (!topTask) {
    return {
      title: "No immediate risk flagged",
      summary: "Once active assignments/quizzes are detected, this card will explain what to handle first and why.",
      actions: ["Run course and calendar sync to populate your active work list."]
    };
  }

  const now = Date.now();
  const oneDayMs = 1000 * 60 * 60 * 24;
  const upcomingCount = allItems.filter((item) => {
    const dueMs = new Date(item.dueAt).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs >= now && dueMs <= now + oneDayMs * 7;
  }).length;
  const overdueCount = allItems.filter((item) => {
    const dueMs = new Date(item.dueAt).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs < now;
  }).length;
  const dueTodayCount = allItems.filter((item) => {
    const dueMs = new Date(item.dueAt).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs >= now && dueMs <= now + oneDayMs;
  }).length;
  const changedItemsCount = allItems.filter((item) => item.recentlyChanged).length;
  const riskBand = severityLabel(topTask.riskScore);

  const bandText = overdueCount > 0
    ? `${overdueCount} item${overdueCount === 1 ? "" : "s"} need immediate recovery`
    : dueTodayCount > 0
      ? "Today is deadline-heavy"
      : riskBand === "high"
        ? "This week needs focused execution"
        : riskBand === "moderate"
          ? "Steady progress will keep you on track"
          : "Risk is low if you start early";

  const firstAction =
    topTask.checklistTasks[0]?.text ?? `Open "${topTask.title}" and confirm exact submission requirements.`;
  const secondAction =
    topTask.checklistTasks[1]?.text ?? `Start at least one focused block on "${topTask.title}" today.`;
  const thirdAction =
    changedItemsCount > 0
      ? `Re-check updated instructions on ${changedItemsCount} recently changed item${
          changedItemsCount === 1 ? "" : "s"
        }.`
      : `Block ${Math.max(30, Math.min(90, Math.round(topTask.estimatedMinutes * 0.35)))} focused minutes today.`;

  return {
    title: bandText,
    summary: `${topTask.title} is your highest-leverage item (${dueInDaysText(
      topTask.dueAt
    )}). You currently have ${upcomingCount} deadline${upcomingCount === 1 ? "" : "s"} inside the next week.`,
    actions: [firstAction, secondAction, thirdAction].slice(0, 3)
  };
}

export default function DashboardPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [context, setContext] = useState<WorkPlanContextResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventDTO[]>([]);
  const [forecast, setForecast] = useState<WorkloadForecastData | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");
  const [checkedTodoIds, setCheckedTodoIds] = useState<Record<string, boolean>>({});

  const topTask = context?.highestLeverageTask ?? null;
  const topTaskItem = useMemo(
    () => context?.workItems.find((item) => item.id === topTask?.id) ?? null,
    [context?.workItems, topTask?.id]
  );

  const timelinePreview = useMemo(
    () => deduplicateBySource(timelineEvents, "due").slice(0, 8),
    [timelineEvents]
  );
  const fallbackWorkItems = useMemo(() => context?.workItems.slice(0, 8) ?? [], [context?.workItems]);

  const todoItems = useMemo(() => {
    if (!context) return [];

    const prioritized = [...context.workItems]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 3);

    const checklistBackedTasks = prioritized.flatMap((item) => {
      const checklist = item.checklistTasks.slice(0, 2);
      if (checklist.length === 0) {
        return [
          {
            id: `${item.id}:fallback`,
            title: item.title,
            action: `Start the next concrete step for "${item.title}".`,
            dueText: dueInDaysText(item.dueAt),
            href: item.taskUrl
          }
        ];
      }

      return checklist.map((task) => ({
        id: `${item.id}:${task.id}`,
        title: item.title,
        action: task.text,
        dueText: dueInDaysText(item.dueAt),
        href: item.taskUrl
      }));
    });

    return checklistBackedTasks.slice(0, 6);
  }, [context]);

  const riskCopy = useMemo(
    () => buildRiskCopy(topTaskItem, context?.workItems ?? []),
    [context?.workItems, topTaskItem]
  );

  const workloadCopy = useMemo(() => {
    const firstWeek = forecast?.weeks[0] ?? null;
    const secondWeek = forecast?.weeks[1] ?? null;

    if (firstWeek) {
      const firstWeekHours = firstWeek.featureVector.totalEstimatedHours;
      const firstWeekItems = firstWeek.featureVector.assessmentCount;
      const nextActiveWeek =
        forecast?.weeks.find(
          (week, index) => index > 0 && (week.featureVector.totalEstimatedHours > 0 || week.featureVector.assessmentCount > 0)
        ) ?? null;

      if (firstWeekHours === 0 && firstWeekItems === 0) {
        return {
          title: "No forecasted load in the next 7 days",
          details: nextActiveWeek
            ? `Next active window: ${nextActiveWeek.weekLabel} (${nextActiveWeek.featureVector.totalEstimatedHours}h across ${nextActiveWeek.featureVector.assessmentCount} item${
                nextActiveWeek.featureVector.assessmentCount === 1 ? "" : "s"
              }).`
            : "No upcoming deadlines found in synced forecast data."
        };
      }

      return {
        title: `${firstWeek.weekLabel}: ${firstWeekHours}h across ${firstWeekItems} item${
          firstWeekItems === 1 ? "" : "s"
        }`,
        details: secondWeek
          ? `${workloadSeverityGuidance(firstWeek.severity)} Next week: ${secondWeek.featureVector.totalEstimatedHours}h (${secondWeek.severity}).`
          : workloadSeverityGuidance(firstWeek.severity)
      };
    }

    const now = Date.now();
    const nextWeekItems = (context?.workItems ?? []).filter((item) => {
      const dueMs = new Date(item.dueAt).getTime();
      if (Number.isNaN(dueMs)) return false;
      return dueMs >= now && dueMs <= now + 1000 * 60 * 60 * 24 * 7;
    });
    const nextWeekHours = toHours(nextWeekItems.reduce((sum, item) => sum + item.estimatedMinutes, 0));

    if (nextWeekItems.length === 0) {
      const laterCount = (context?.workItems ?? []).length;
      return {
        title: "No due deadlines in the next 7 days",
        details:
          laterCount > 0
            ? `${laterCount} active item${laterCount === 1 ? "" : "s"} still exist beyond this week.`
            : "Sync courses and calendar to populate active workload."
      };
    }

    return {
      title: `${nextWeekItems.length} deadline${nextWeekItems.length === 1 ? "" : "s"} in next 7 days`,
      details: `${nextWeekHours}h estimated from current live tasks.`
    };
  }, [context?.workItems, forecast?.weeks]);

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const nextCourses = await getCourses();
      setCourses(nextCourses);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to load courses";
      toast.error("Unable to load courses", { description: message });
    } finally {
      setIsLoadingCourses(false);
    }
  }, [router]);

  const loadOverviewData = useCallback(async () => {
    setIsLoadingOverview(true);

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 2);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(to.getDate() + 45);
    to.setHours(23, 59, 59, 999);

    try {
      const [statusResult, contextResult, timelineResult, forecastResult] = await Promise.allSettled([
        getD2LStatus(),
        getWorkPlanContext(),
        getCalendarEvents({
          from: from.toISOString(),
          to: to.toISOString(),
          include: ["due", "event"]
        }),
        getWorkloadForecast()
      ]);

      if (statusResult.status === "fulfilled") {
        if (statusResult.value.connected) {
          setConnectionState("connected");
        } else {
          setConnectionState(statusResult.value.reason);
        }
      } else {
        setConnectionState("loading");
      }

      if (contextResult.status === "fulfilled") {
        setContext(contextResult.value);
        setConnectionState((previous) => (previous === "loading" ? "connected" : previous));
      } else {
        const error = contextResult.reason;
        if (error instanceof ApiError && error.status === 401) {
          router.push("/login");
          return;
        }

        if (error instanceof ApiError) {
          if (error.code === "session_expired") {
            setConnectionState("expired");
            toast.error("Overview unavailable", {
              description: "D2L session expired. Reconnect from login."
            });
          } else if (error.code === "not_connected") {
            setConnectionState("disconnected");
            toast.error("Overview unavailable", {
              description: "Connect to D2L first to fetch live overview data."
            });
          } else {
            toast.error("Overview unavailable", { description: error.message });
          }
        } else {
          toast.error("Overview unavailable", {
            description: error instanceof Error ? error.message : "Failed to load work context"
          });
        }

        setContext(null);
      }

      if (timelineResult.status === "fulfilled") {
        setTimelineEvents(timelineResult.value.events);
      } else {
        setTimelineEvents([]);
      }

      if (forecastResult.status === "fulfilled") {
        setForecast(forecastResult.value);
      } else {
        setForecast(null);
      }
    } finally {
      setIsLoadingOverview(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCourses();
    void loadOverviewData();
  }, [loadCourses, loadOverviewData]);

  async function handleSyncCourses() {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncCourses();
      toast.success("Courses synced", {
        description: `${result.coursesSynced} courses updated.`
      });
      await Promise.all([loadCourses(), loadOverviewData()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      toast.error("Sync failed", { description: message });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="card-glow animate-fade-up overflow-hidden" style={{ animationDelay: "0ms" }}>
          <div className="h-1 w-full bg-gradient-to-r from-primary/65 via-primary/15 to-transparent" />
          <CardHeader className="pb-3">
            <OverviewCardTitle icon={Target} title="Highest Leverage Task Right Now" iconClassName="text-primary" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {isLoadingOverview ? (
              <p>Loading intelligence...</p>
            ) : topTask && topTaskItem ? (
              <>
                <p className="font-medium text-foreground">{topTask.title}</p>
                <p>{topTask.reason}</p>
                <p className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {startCase(dueInDaysText(topTaskItem.dueAt))} · Estimated {toHours(topTaskItem.estimatedMinutes)}h
                </p>
                <a
                  href={topTaskItem.taskUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  Open in D2L
                  <ArrowRight className="h-4 w-4" />
                </a>
              </>
            ) : (
              <p>No active tasks detected yet. Sync calendar and keep D2L connected.</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-glow animate-fade-up overflow-hidden" style={{ animationDelay: "75ms" }}>
          <div className="h-1 w-full bg-gradient-to-r from-destructive/70 via-destructive/15 to-transparent" />
          <CardHeader className="pb-3">
            <OverviewCardTitle icon={AlertTriangle} title="Risk Alert" iconClassName="text-destructive" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {isLoadingOverview ? (
              <p>Loading risk summary...</p>
            ) : (
              <>
                <p className="font-medium text-foreground">{riskCopy.title}</p>
                <p>{riskCopy.summary}</p>
                {riskCopy.actions.map((action) => (
                  <div key={action} className="flex items-start gap-2 text-foreground/80">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                    <p>{action}</p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-glow animate-fade-up overflow-hidden" style={{ animationDelay: "150ms" }}>
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary/10 to-transparent" />
          <CardHeader className="pb-3">
            <OverviewCardTitle icon={BarChart3} title="Workload Radar Preview" iconClassName="text-primary" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {isLoadingOverview ? (
              <p>Loading forecast...</p>
            ) : (
              <>
                <p className="font-medium text-foreground">{workloadCopy.title}</p>
                <p>{workloadCopy.details}</p>
                <Link href={"/dashboard/workload-forecast" as any} className="inline-flex items-center gap-2 text-primary hover:underline">
                  <BarChart3 className="h-4 w-4" />
                  Open Weekly Workload
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-glow animate-fade-up overflow-hidden" style={{ animationDelay: "225ms" }}>
          <div className="h-1 w-full bg-gradient-to-r from-foreground/65 via-foreground/15 to-transparent" />
          <CardHeader className="pb-3">
            <OverviewCardTitle icon={ListTodo} title="To Do" iconClassName="text-foreground" />
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm text-muted-foreground">
            {isLoadingOverview ? (
              <p>Loading tasks...</p>
            ) : todoItems.length > 0 ? (
              todoItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={Boolean(checkedTodoIds[item.id])}
                    onChange={(event) =>
                      setCheckedTodoIds((prev) => ({
                        ...prev,
                        [item.id]: event.target.checked
                      }))
                    }
                  />
                  <div className="min-w-0">
                    <a href={item.href} target="_blank" rel="noreferrer" className="block text-sm text-foreground hover:underline">
                      {item.title}
                    </a>
                    <p className="text-xs text-muted-foreground">{item.action}</p>
                    <p className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {startCase(item.dueText)}
                    </p>
                  </div>
                </label>
              ))
            ) : (
              <p>No active to-do items yet. Run sync to load upcoming coursework tasks.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void handleSyncCourses()}
            disabled={isSyncing || connectionState === "expired" || connectionState === "disconnected"}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {isSyncing ? "Syncing courses..." : "Sync courses"}
          </Button>
        </div>

        {(connectionState === "expired" || connectionState === "disconnected") && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Reconnect required</AlertTitle>
            <AlertDescription>
              Your saved D2L session is unavailable. Reconnect from the login screen.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingOverview ? (
              <p className="text-sm text-muted-foreground">Loading timeline...</p>
            ) : timelinePreview.length > 0 ? (
              timelinePreview.map((event) => {
                const overviewHref = buildOverviewHref(event);
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {(event.courseCode ?? event.courseName ?? "course")} · {formatDateTime(event.startAt)}
                        </p>
                      </div>
                      <Badge variant={event.dateKind === "due" ? "default" : "secondary"}>{startCase(event.dateKind)}</Badge>
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {startCase(event.sourceType.replace(/_/g, " "))} · Org unit {event.orgUnitId}
                    </p>
                  </>
                );

                const className =
                  "block rounded-md border border-border/80 bg-secondary/30 p-3 transition-colors hover:border-primary/20 hover:bg-secondary/50";

                if (overviewHref) {
                  return (
                    <Link key={event.id} href={overviewHref as any} className={className}>
                      {content}
                    </Link>
                  );
                }

                if (event.viewUrl) {
                  return (
                    <a key={event.id} href={event.viewUrl} target="_blank" rel="noreferrer" className={className}>
                      {content}
                    </a>
                  );
                }

                return (
                  <div key={event.id} className={className}>
                    {content}
                  </div>
                );
              })
            ) : fallbackWorkItems.length > 0 ? (
              fallbackWorkItems.map((item) => (
                <a
                  key={item.id}
                  href={item.taskUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-border/80 bg-secondary/30 p-3 transition-colors hover:border-primary/20 hover:bg-secondary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.courseName} · {startCase(dueInDaysText(item.dueAt))}
                      </p>
                    </div>
                    <Badge variant="secondary">{startCase(item.type)}</Badge>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    estimated {toHours(item.estimatedMinutes)}h
                  </p>
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No timeline items found yet. Sync calendar to populate this section with assignment and quiz dates.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              Courses
            </CardTitle>
          </CardHeader>
          <CardContent>{isLoadingCourses ? <CourseSkeleton /> : <CourseList courses={courses} />}</CardContent>
        </Card>
      </section>
    </div>
  );
}
