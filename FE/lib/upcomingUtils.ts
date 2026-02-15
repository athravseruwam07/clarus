import {
  addMonths,
  addWeeks,
  endOfMonth,
  isToday,
  isTomorrow,
  isThisWeek,
  startOfDay
} from "date-fns";

import type { TimelineDateKind, TimelineEventDTO } from "@/lib/api";
import { classifyEvent, safeDateFromIso, type AgendaCategory } from "@/lib/classifyEvent";

// ---------------------------------------------------------------------------
// Urgency
// ---------------------------------------------------------------------------

export type UrgencyLevel = "due_today" | "due_tomorrow" | "due_this_week" | "due_next_week" | "upcoming";

export function computeUrgency(eventDate: Date, now: Date): UrgencyLevel {
  if (isToday(eventDate)) return "due_today";
  if (isTomorrow(eventDate)) return "due_tomorrow";
  if (isThisWeek(eventDate, { weekStartsOn: 1 })) return "due_this_week";

  const nextWeekEnd = addWeeks(startOfDay(now), 2);
  if (eventDate < nextWeekEnd) return "due_next_week";

  return "upcoming";
}

export function urgencyBadgeProps(level: UrgencyLevel): { label: string; variant: "destructive" | "default" | "secondary" } {
  switch (level) {
    case "due_today":
      return { label: "today", variant: "destructive" };
    case "due_tomorrow":
      return { label: "tomorrow", variant: "destructive" };
    case "due_this_week":
      return { label: "this week", variant: "default" };
    case "due_next_week":
      return { label: "next week", variant: "secondary" };
    case "upcoming":
      return { label: "upcoming", variant: "secondary" };
  }
}

// ---------------------------------------------------------------------------
// Time grouping
// ---------------------------------------------------------------------------

export type TimeGroupKey =
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "later_this_month"
  | "next_month"
  | "further_out";

export interface TimeGroup {
  key: TimeGroupKey;
  label: string;
  events: TimelineEventDTO[];
}

export function groupEventsByTime(events: TimelineEventDTO[], now: Date): TimeGroup[] {
  const buckets: Record<TimeGroupKey, TimelineEventDTO[]> = {
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    later_this_month: [],
    next_month: [],
    further_out: []
  };

  const nextWeekEnd = addWeeks(startOfDay(now), 2);
  const monthEnd = endOfMonth(now);
  const nextMonthEnd = endOfMonth(addMonths(now, 1));

  for (const event of events) {
    const date = safeDateFromIso(event.startAt);
    if (!date) continue;

    if (isToday(date)) {
      buckets.today.push(event);
    } else if (isTomorrow(date)) {
      buckets.tomorrow.push(event);
    } else if (isThisWeek(date, { weekStartsOn: 1 })) {
      buckets.this_week.push(event);
    } else if (date < nextWeekEnd) {
      buckets.next_week.push(event);
    } else if (date <= monthEnd) {
      buckets.later_this_month.push(event);
    } else if (date <= nextMonthEnd) {
      buckets.next_month.push(event);
    } else {
      buckets.further_out.push(event);
    }
  }

  const labelMap: Record<TimeGroupKey, string> = {
    today: "today",
    tomorrow: "tomorrow",
    this_week: "this week",
    next_week: "next week",
    later_this_month: "later this month",
    next_month: "next month",
    further_out: "further out"
  };

  return (Object.keys(buckets) as TimeGroupKey[])
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: labelMap[key], events: buckets[key] }));
}

// ---------------------------------------------------------------------------
// Deep link builder
// ---------------------------------------------------------------------------

export function buildOverviewHref(event: TimelineEventDTO): string | null {
  const params = new URLSearchParams();
  if (event.viewUrl) {
    params.set("openUrl", event.viewUrl);
  }

  const qs = params.toString();

  if (event.associatedEntityType === "D2L.LE.Dropbox.Dropbox" && event.associatedEntityId) {
    const base = `/dashboard/assignments/overview/${encodeURIComponent(event.orgUnitId)}/${encodeURIComponent(event.associatedEntityId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  if (event.associatedEntityType === "D2L.LE.Content.ContentObject.TopicCO" && event.associatedEntityId) {
    const base = `/dashboard/content/overview/${encodeURIComponent(event.orgUnitId)}/${encodeURIComponent(event.associatedEntityId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  if (event.associatedEntityType === "D2L.LE.Quizzing.Quiz" && event.associatedEntityId) {
    const base = `/dashboard/quizzes/overview/${encodeURIComponent(event.orgUnitId)}/${encodeURIComponent(event.associatedEntityId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  if (event.sourceType === "calendar") {
    const base = `/dashboard/calendar/overview/${encodeURIComponent(event.sourceId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Category filters
// ---------------------------------------------------------------------------

export function filterAssignments(events: TimelineEventDTO[]): TimelineEventDTO[] {
  return events.filter((e) => classifyEvent(e) === "assignment");
}

export function filterQuizzes(events: TimelineEventDTO[]): TimelineEventDTO[] {
  return events.filter((e) => classifyEvent(e) === "quiz");
}

export function filterExams(events: TimelineEventDTO[]): TimelineEventDTO[] {
  return events.filter((e) => classifyEvent(e) === "exam");
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export function deduplicateBySource(
  events: TimelineEventDTO[],
  preferredDateKind: TimelineDateKind
): TimelineEventDTO[] {
  const byKey = new Map<string, TimelineEventDTO>();

  for (const event of events) {
    const key = `${event.sourceType}:${event.sourceId}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, event);
      continue;
    }

    // Prefer the preferred dateKind; if neither matches keep the first one.
    if (existing.dateKind !== preferredDateKind && event.dateKind === preferredDateKind) {
      byKey.set(key, event);
    }
  }

  return Array.from(byKey.values());
}
