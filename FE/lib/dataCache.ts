/**
 * Module-level in-memory cache for dashboard data.
 *
 * State persists as long as the JS bundle is loaded (i.e. across tab switches
 * within the same browser session). A hard page refresh resets everything.
 *
 * Each cache slot has three operations:
 *   get()        → returns cached data or null
 *   set(data)    → stores data in the cache
 *   invalidate() → clears the slot so the next load fetches fresh data
 */

import type { CalendarTimelineResponse, Course, WorkloadForecastData, WorkPlanContextResponse } from "@/lib/api";

type CacheEntry<T> = { data: T } | null;

function makeSlot<T>() {
  let entry: CacheEntry<T> = null;
  return {
    get: (): T | null => entry?.data ?? null,
    set: (data: T): void => { entry = { data }; },
    invalidate: (): void => { entry = null; },
  };
}

/** Cache slot that also validates a params key, so filter changes bypass cache. */
function makeKeyedSlot<T>() {
  let entry: (CacheEntry<T> & { key: string }) | null = null;
  return {
    get: (key: string): T | null => (entry?.key === key ? entry.data : null),
    set: (key: string, data: T): void => { entry = { data, key }; },
    invalidate: (): void => { entry = null; },
  };
}

export const dataCache = {
  /** Enrolled courses — shared by Overview and Upcoming */
  courses: makeSlot<Course[]>(),

  /** Calendar events for the Overview dashboard (-2d to +45d) */
  dashboardEvents: makeSlot<CalendarTimelineResponse>(),

  /** Calendar events for the Upcoming shell (today to +3mo) */
  upcomingEvents: makeSlot<CalendarTimelineResponse>(),

  /** Calendar events for the Timeline Intelligence page (keyed by query params) */
  timelineEvents: makeKeyedSlot<CalendarTimelineResponse>(),

  /** Weekly workload forecast — shared by Overview and Weekly Workload page */
  workloadForecast: makeSlot<WorkloadForecastData>(),

  /** Work plan context — shared by Overview and Study Plan Optimizer */
  workPlanContext: makeSlot<WorkPlanContextResponse>(),

  /** Invalidates every slot at once (e.g. on logout or full sync) */
  invalidateAll(): void {
    this.courses.invalidate();
    this.dashboardEvents.invalidate();
    this.upcomingEvents.invalidate();
    this.timelineEvents.invalidate();
    this.workloadForecast.invalidate();
    this.workPlanContext.invalidate();
  },
};
