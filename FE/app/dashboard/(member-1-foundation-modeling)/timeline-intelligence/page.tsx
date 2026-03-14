"use client";

import {
  addDays,
  addMonths,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  ApiError,
  getCalendarEvents,
  syncCalendar,
  type TimelineDateKind,
  type TimelineEventDTO,
  type TimelineSourceType
} from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { classifyEvent, safeDateFromIso, sortByStartAt } from "@/lib/classifyEvent";
import { dataCache } from "@/lib/dataCache";
import { buildOverviewHref } from "@/lib/upcomingUtils";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function startCase(value: string): string {
  if (!value) return value;
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1).replace(/_/g, " ")}`;
}

function FilterPill(props: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={props.active}
      className={cn(
        "h-8 rounded-full border px-3 text-xs transition-all",
        props.active
          ? "border-primary/35 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          : "border-border/70 bg-background text-muted-foreground hover:border-primary/25 hover:bg-secondary/20 hover:text-foreground"
      )}
      onClick={props.onClick}
    >
      {props.active ? <Check className="h-3.5 w-3.5" /> : null}
      <span>{props.children}</span>
    </Button>
  );
}

export default function TimelineIntelligencePage() {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const [events, setEvents] = useState<TimelineEventDTO[]>([]);
  const [needsSync, setNeedsSync] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters: keep usable by default (due + calendar events).
  const [includeKinds, setIncludeKinds] = useState<TimelineDateKind[]>(["due", "event"]);
  const [sourceGroups, setSourceGroups] = useState(() => ({
    calendar: true,
    content: true,
    dropbox: true,
    quiz: true,
    discussion: true,
    checklist: true
    }));

  // Noise filter: hide low-signal items by default (content release/posted windows, checklists, unknown "other").
  const [noiseFlags, setNoiseFlags] = useState(() => ({
    content: false,
    checklists: false,
    other: false
  }));

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [visibleMonth]);

  const { rangeFromIso, rangeToIso } = useMemo(() => {
    const start = startOfDay(gridDays[0] ?? new Date());
    const end = endOfDay(gridDays[41] ?? new Date());
    return {
      rangeFromIso: start.toISOString(),
      rangeToIso: end.toISOString()
    };
  }, [gridDays]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const category = classifyEvent(event);
      if (category === "content" && !noiseFlags.content) return false;
      if (category === "checklist" && !noiseFlags.checklists) return false;
      if (category === "other" && !noiseFlags.other) return false;
      return true;
    });
  }, [events, noiseFlags]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimelineEventDTO[]>();

    filteredEvents.forEach((event) => {
      const startAt = safeDateFromIso(event.startAt);
      if (!startAt) {
        return;
      }

      const key = dayKey(startAt);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    });

    for (const [key, list] of map.entries()) {
      map.set(key, [...list].sort(sortByStartAt));
    }

    return map;
  }, [filteredEvents]);

  const selectedEvents = useMemo(() => {
    return eventsByDay.get(dayKey(selectedDay)) ?? [];
  }, [eventsByDay, selectedDay]);

  const agendaByCategory = useMemo(() => {
    const assignments: TimelineEventDTO[] = [];
    const exams: TimelineEventDTO[] = [];
    const quizzes: TimelineEventDTO[] = [];
    const labs: TimelineEventDTO[] = [];
    const tutorials: TimelineEventDTO[] = [];
    const officeHours: TimelineEventDTO[] = [];
    const classes: TimelineEventDTO[] = [];
    const discussions: TimelineEventDTO[] = [];
    const checklists: TimelineEventDTO[] = [];
    const content: TimelineEventDTO[] = [];
    const other: TimelineEventDTO[] = [];

    selectedEvents.forEach((event) => {
      const category = classifyEvent(event);
      if (category === "assignment") {
        assignments.push(event);
        return;
      }

      if (category === "exam") {
        exams.push(event);
        return;
      }

      if (category === "quiz") {
        quizzes.push(event);
        return;
      }

      if (category === "lab") {
        labs.push(event);
        return;
      }

      if (category === "tutorial") {
        tutorials.push(event);
        return;
      }

      if (category === "office_hours") {
        officeHours.push(event);
        return;
      }

      if (category === "class") {
        classes.push(event);
        return;
      }

      if (category === "discussion") {
        discussions.push(event);
        return;
      }

      if (category === "checklist") {
        checklists.push(event);
        return;
      }

      if (category === "content") {
        content.push(event);
        return;
      }

      other.push(event);
    });

    return {
      assignments,
      exams,
      quizzes,
      labs,
      tutorials,
      officeHours,
      classes,
      discussions,
      checklists,
      content,
      other
    };
  }, [selectedEvents]);

  const selectedSources = useMemo(() => {
    const allSelected = Object.values(sourceGroups).every(Boolean);
    if (allSelected) {
      return undefined;
    }

    const sources: TimelineSourceType[] = [];
    if (sourceGroups.calendar) sources.push("calendar");
    if (sourceGroups.content) sources.push("content_module", "content_topic");
    if (sourceGroups.dropbox) sources.push("dropbox_folder");
    if (sourceGroups.quiz) sources.push("quiz");
    if (sourceGroups.discussion) sources.push("discussion_forum", "discussion_topic");
    if (sourceGroups.checklist) sources.push("checklist");
    return sources;
  }, [sourceGroups]);

  const loadCalendar = useCallback(async () => {
    const cacheKey = `${rangeFromIso}|${rangeToIso}|${includeKinds?.join(",") ?? ""}|${selectedSources?.join(",") ?? ""}`;
    const cached = dataCache.timelineEvents.get(cacheKey);
    if (cached) {
      setEvents(cached.events);
      setNeedsSync(cached.needsSync);
      setLastSyncedAt(cached.lastSyncedAt);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await getCalendarEvents({
        from: rangeFromIso,
        to: rangeToIso,
        include: includeKinds,
        sources: selectedSources
      });
      dataCache.timelineEvents.set(cacheKey, payload);
      setEvents(payload.events);
      setNeedsSync(payload.needsSync);
      setLastSyncedAt(payload.lastSyncedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load calendar";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [includeKinds, rangeFromIso, rangeToIso, selectedSources]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const handleSync = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      dataCache.timelineEvents.invalidate();
      const result = await syncCalendar();
      if (result.orgUnitsForbidden && result.orgUnitsForbidden.length > 0) {
        toast.success("Calendar synced (partial)", {
          description: `${result.orgUnitsForbidden.length} course(s) blocked calendar access on Brightspace and were skipped.`
        });
      } else {
        toast.success("Calendar synced");
      }
      await loadCalendar();
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
  }, [isSyncing, loadCalendar]);

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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="h-full card-glow">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Calendar</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">{format(visibleMonth, "MMMM yyyy")}</p>
                {lastSyncedAt ? (
                  <span className="text-xs text-muted-foreground/80">
                    · Last sync {new Date(lastSyncedAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setVisibleMonth(startOfMonth(today));
                  setSelectedDay(startOfDay(today));
                }}
              >
                Today
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVisibleMonth((prev) => startOfMonth(addMonths(prev, -1)))}
                aria-label="previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVisibleMonth((prev) => startOfMonth(addMonths(prev, 1)))}
                aria-label="next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!needsSync ? (
                <Button variant="ghost" size="sm" onClick={() => void handleSync()} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Resync
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                  Show
                </span>
                {(["start", "due", "end", "event"] as const).map((kind) => {
                  const selected = includeKinds.includes(kind);
                  return (
                    <FilterPill
                      key={kind}
                      active={selected}
                      onClick={() => {
                        setIncludeKinds((prev) => {
                          const has = prev.includes(kind);
                          const next = has ? prev.filter((entry) => entry !== kind) : [...prev, kind];
                          return next.length > 0 ? next : prev;
                        });
                      }}
                    >
                      {startCase(kind)}
                    </FilterPill>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                  Sources
                </span>
                {(
                  [
                    { key: "calendar", label: "Calendar" },
                    { key: "content", label: "Content" },
                    { key: "dropbox", label: "Dropbox" },
                    { key: "quiz", label: "Quizzes" },
                    { key: "discussion", label: "Discussions" },
                    { key: "checklist", label: "Checklists" }
                  ] as const
                ).map((item) => {
                  const selected = sourceGroups[item.key];
                  return (
                    <FilterPill
                      key={item.key}
                      active={selected}
                      onClick={() => {
                        setSourceGroups((prev) => {
                          const next = { ...prev, [item.key]: !prev[item.key] };
                          const anySelected = Object.values(next).some(Boolean);
                          return anySelected ? next : prev;
                        });
                      }}
                    >
                      {item.label}
                    </FilterPill>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                  Also show
                </span>
                {(
                  [
                    { key: "content", label: "Content" },
                    { key: "checklists", label: "Checklists" },
                    { key: "other", label: "Other" }
                  ] as const
                ).map((item) => {
                  const selected = noiseFlags[item.key];
                  return (
                    <FilterPill
                      key={item.key}
                      active={selected}
                      onClick={() => setNoiseFlags((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    >
                      {item.label}
                    </FilterPill>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-1 text-center">
                  {label}
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border/80 bg-secondary/10">
              {isLoading ? (
                <div className="grid grid-cols-7 gap-px bg-border/70 p-px">
                  {Array.from({ length: 42 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-square w-full rounded-none" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-px bg-border/70 p-px">
                  {gridDays.map((day) => {
                    const key = dayKey(day);
                    const count = eventsByDay.get(key)?.length ?? 0;

                    const isSelected = isSameDay(day, selectedDay);
                    const outsideMonth = !isSameMonth(day, visibleMonth);
                    const isDayToday = isToday(day);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDay(startOfDay(day))}
                        className={cn(
                          "group flex aspect-square flex-col justify-between bg-card/40 p-2 text-left transition-colors hover:bg-secondary/35",
                          outsideMonth ? "bg-card/25 text-muted-foreground/70" : "text-foreground",
                          isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/35" : null,
                          !isSelected && isDayToday ? "ring-1 ring-inset ring-primary/15" : null
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              outsideMonth ? "text-muted-foreground/70" : "text-foreground",
                              isDayToday ? "text-primary" : null
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {count > 0 ? (
                            <span className="text-[10px] font-semibold text-muted-foreground/80">
                              {count}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(3, count) }).map((_, index) => (
                            <span
                              key={index}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isSelected ? "bg-primary" : "bg-primary/70"
                              )}
                            />
                          ))}
                          {count > 3 ? (
                            <span className="text-[10px] text-muted-foreground/80">+{count - 3}</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full card-glow">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Agenda</CardTitle>
                <p className="text-sm text-muted-foreground">{format(selectedDay, "EEEE, MMM d")}</p>
              </div>
              <Badge variant={selectedEvents.length > 0 ? "default" : "secondary"}>
                {selectedEvents.length} items
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
                No items on this day.
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: "assignments", label: "Assignments", items: agendaByCategory.assignments },
                    { key: "exams", label: "Exams", items: agendaByCategory.exams },
                    { key: "quizzes", label: "Quizzes", items: agendaByCategory.quizzes },
                    { key: "classes", label: "Classes", items: agendaByCategory.classes },
                    { key: "labs", label: "Labs", items: agendaByCategory.labs },
                    { key: "tutorials", label: "Tutorials", items: agendaByCategory.tutorials },
                    { key: "officeHours", label: "Office hours", items: agendaByCategory.officeHours },
                    { key: "discussions", label: "Discussions", items: agendaByCategory.discussions },
                    { key: "checklists", label: "Checklists", items: agendaByCategory.checklists },
                    { key: "content", label: "Content", items: agendaByCategory.content },
                    { key: "other", label: "Other", items: agendaByCategory.other }
                  ] as const
                )
                  .filter((section) => section.items.length > 0)
                  .map((section) => (
                    <div key={section.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                          {section.label}
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {section.items.length}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {section.items.map((event) => {
                          const startAt = safeDateFromIso(event.startAt);
                          const timeLabel = event.isAllDay ? "All day" : startAt ? format(startAt, "p") : "TBD";
                          const courseLabel = event.courseName ?? event.courseCode;
                          const category = classifyEvent(event);
                          const isSubmitted = event.submissionStatus?.state === "submitted";

                          const overviewHref = buildOverviewHref(event);

                          return (
                            <div
                              key={event.id}
                              className={cn(
                                "rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50 hover:border-primary/20"
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">{timeLabel}</span>
                                    {courseLabel ? (
                                      <span className="text-xs text-muted-foreground">· {courseLabel}</span>
                                    ) : null}
                                    <Badge variant="secondary" className="text-[10px]">
                                      {startCase(event.dateKind)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {startCase(event.sourceType)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {startCase(category)}
                                    </Badge>
                                    {isSubmitted ? (
                                      <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                                        Completed
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                                  {isSubmitted && event.submissionStatus?.latestSubmissionAt ? (
                                    <p className="text-xs text-emerald-700">
                                      Submitted {format(new Date(event.submissionStatus.latestSubmissionAt), "PPp")}
                                    </p>
                                  ) : null}
                                  {event.description ? (
                                    <p className="line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                  {overviewHref ? (
                                    <Link
                                      href={overviewHref as any}
                                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                                    >
                                      View overview
                                    </Link>
                                  ) : null}

                                  {event.viewUrl ? (
                                    <a
                                      href={event.viewUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                                    >
                                      Open
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
