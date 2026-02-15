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
  { label: "assignments", href: "/dashboard/upcoming/assignments" },
  { label: "quizzes", href: "/dashboard/upcoming/quizzes" },
  { label: "exams", href: "/dashboard/upcoming/exams" }
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
      const message = error instanceof Error ? error.message : "failed to load calendar";
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
        toast.success("calendar synced (partial)", {
          description: `${result.orgUnitsForbidden.length} course(s) blocked calendar access on Brightspace and were skipped.`
        });
      } else {
        toast.success("calendar synced");
      }
      await loadData();
    } catch (error) {
      if (error instanceof ApiError && error.code === "no_courses") {
        toast.error("sync courses first", { description: "run course sync from the dashboard before syncing calendar." });
        return;
      }
      if (error instanceof ApiError && error.code === "not_connected") {
        toast.error("connect to d2l first", { description: "reconnect from the login screen and retry." });
        return;
      }
      if (error instanceof ApiError && error.code === "calendar_forbidden") {
        toast.error("calendar unavailable", { description: "Brightspace blocked calendar access for this account." });
        return;
      }
      if (error instanceof ApiError && error.code === "session_expired") {
        toast.error("session expired", { description: "reconnect from the login screen and retry." });
        return;
      }
      const message = error instanceof Error ? error.message : "calendar sync failed";
      toast.error("calendar sync failed", { description: message });
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
            <span>calendar needs sync</span>
            <Button onClick={() => void handleSync()} disabled={isSyncing} size="sm">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {isSyncing ? "syncing..." : "sync calendar"}
            </Button>
          </AlertTitle>
          <AlertDescription>
            {lastSyncedAt ? `last synced ${new Date(lastSyncedAt).toLocaleString()}` : "no calendar sync found yet."}
          </AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>calendar unavailable</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">upcoming</h1>
        {lastSyncedAt && !needsSync ? (
          <span className="text-xs text-muted-foreground/80">
            last sync {new Date(lastSyncedAt).toLocaleString()}
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
            course
          </span>
          <Button
            type="button"
            variant={selectedCourseId === null ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-7 px-2 text-xs", selectedCourseId !== null ? "border border-border/60" : null)}
            onClick={() => setSelectedCourseId(null)}
          >
            all
          </Button>
          {uniqueCourses.map((course) => {
            const isActive = selectedCourseId === course.brightspaceCourseId;
            return (
              <Button
                key={course.id}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 px-2 text-xs", !isActive ? "border border-border/60" : null)}
                onClick={() => setSelectedCourseId(isActive ? null : course.brightspaceCourseId)}
              >
                {course.courseCode ?? course.courseName}
              </Button>
            );
          })}
        </div>
      ) : null}

      {children({ events: filteredEvents, isLoading, errorMessage, selectedCourseId })}
    </div>
  );
}
