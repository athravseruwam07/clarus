"use client";

import { addMonths, startOfDay } from "date-fns";
import { Loader2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  getCalendarEvents,
  getCourses,
  syncCalendar,
  type Course,
  type TimelineEventDTO
} from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Assignments", href: "/dashboard/upcoming/assignments" },
  { label: "Quizzes", href: "/dashboard/upcoming/quizzes" },
  { label: "Exams", href: "/dashboard/upcoming/exams" }
] as const;

export interface UpcomingChildProps {
  events: TimelineEventDTO[];
  isLoading: boolean;
  errorMessage: string | null;
  selectedCourseId: string | null;
}

interface UpcomingPageShellProps {
  children: (props: UpcomingChildProps) => React.ReactNode;
}

function courseFilterLabel(course: Course): string {
  return course.courseName ?? course.courseCode ?? "Untitled course";
}

export default function UpcomingPageShell({ children }: UpcomingPageShellProps) {
  const pathname = usePathname();

  const [events, setEvents] = useState<TimelineEventDTO[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [needsSync, setNeedsSync] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const now = new Date();
      const [calendarPayload, courseList] = await Promise.all([
        getCalendarEvents({
          from: startOfDay(now).toISOString(),
          to: addMonths(now, 3).toISOString(),
          include: ["due", "event", "start", "end"]
        }),
        getCourses().catch(() => [] as Course[])
      ]);

      setEvents(calendarPayload.events);
      setNeedsSync(calendarPayload.needsSync);
      setLastSyncedAt(calendarPayload.lastSyncedAt);
      setCourses(courseList);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load calendar";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncCalendar();
      if (result.orgUnitsForbidden && result.orgUnitsForbidden.length > 0) {
        toast.success("Calendar synced (partial)", {
          description: `${result.orgUnitsForbidden.length} course(s) blocked calendar access on Brightspace and were skipped.`
        });
      } else {
        toast.success("Calendar synced");
      }
      await loadData();
    } catch (error) {
      if (error instanceof ApiError && error.code === "no_courses") {
        toast.error("Sync courses first", { description: "Run course sync from the dashboard before syncing calendar." });
        return;
      }
      if (error instanceof ApiError && error.code === "not_connected") {
        toast.error("Connect to D2L first", { description: "Reconnect from the login screen and retry." });
        return;
      }
      if (error instanceof ApiError && error.code === "calendar_forbidden") {
        toast.error("Calendar unavailable", { description: "Brightspace blocked calendar access for this account." });
        return;
      }
      if (error instanceof ApiError && error.code === "session_expired") {
        toast.error("Session expired", { description: "Reconnect from the login screen and retry." });
        return;
      }
      const message = error instanceof Error ? error.message : "Calendar sync failed";
      toast.error("Calendar sync failed", { description: message });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadData]);

  const filteredEvents = useMemo(() => {
    if (!selectedCourseId) return events;
    return events.filter((e) => e.orgUnitId === selectedCourseId);
  }, [events, selectedCourseId]);

  // Deduplicate course list for filter buttons using brightspaceCourseId.
  const uniqueCourses = useMemo(() => {
    const seen = new Set<string>();
    return courses.filter((c) => {
      if (seen.has(c.brightspaceCourseId)) return false;
      seen.add(c.brightspaceCourseId);
      return true;
    });
  }, [courses]);

  return (
    <div className="space-y-6">
      {needsSync ? (
        <Alert className="border-primary/20 bg-secondary/20">
          <AlertTitle className="flex items-center justify-between gap-3">
            <span>Calendar needs sync</span>
            <Button onClick={() => void handleSync()} disabled={isSyncing} size="sm">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {isSyncing ? "Syncing..." : "Sync calendar"}
            </Button>
          </AlertTitle>
          <AlertDescription>
            {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : "No calendar sync found yet."}
          </AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Calendar unavailable</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Upcoming</h1>
        {lastSyncedAt && !needsSync ? (
          <span className="text-xs text-muted-foreground/80">
            Last sync {new Date(lastSyncedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {uniqueCourses.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-secondary/10 px-3 py-2.5">
          <label
            htmlFor="upcoming-course-filter"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90"
          >
            Course
          </label>
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <select
              id="upcoming-course-filter"
              value={selectedCourseId ?? "__all__"}
              onChange={(event) =>
                setSelectedCourseId(event.target.value === "__all__" ? null : event.target.value)
              }
              className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
            >
              <option value="__all__">All courses</option>
              {uniqueCourses.map((course) => (
                <option key={course.id} value={course.brightspaceCourseId}>
                  {courseFilterLabel(course)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {children({ events: filteredEvents, isLoading, errorMessage, selectedCourseId })}
    </div>
  );
}
