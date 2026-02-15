import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { connectorRequest } from "../lib/connectorClient.js";
import { AppError, isAppError, safeErrorMessage } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decodeStorageState } from "../lib/storageState.js";

const ORG_UNIT_CHUNK_SIZE = 25;
const MAX_PAGES = 100;

type SourceType =
  | "calendar"
  | "content_module"
  | "content_topic"
  | "dropbox_folder"
  | "quiz"
  | "discussion_forum"
  | "discussion_topic"
  | "checklist"
  | "generic";

type DateKind = "event" | "start" | "due" | "end";

type TimelineDraft = {
  sourceType: SourceType;
  sourceId: string;
  dateKind: DateKind;
  brightspaceOrgUnitId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  isAllDay: boolean;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
  viewUrl: string | null;
  rawData: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readIdentifier(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return null;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((part) => Number(part));
  const bParts = b.split(".").map((part) => Number(part));

  const maxLen = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < maxLen; index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left !== right) {
      return left - right;
    }
  }

  return 0;
}

function findLatestLeVersion(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const candidates: string[] = [];
  const productVersions = record["ProductVersions"];

  if (Array.isArray(productVersions)) {
    for (const entry of productVersions) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) {
        continue;
      }

      const code = readString(entryRecord["ProductCode"])?.toLowerCase();
      if (code !== "le") {
        continue;
      }

      const latest = readString(entryRecord["LatestVersion"]);
      if (latest) {
        candidates.push(latest);
      }

      const versions = entryRecord["Versions"];
      if (Array.isArray(versions)) {
        versions.forEach((version) => {
          const parsed = readString(version);
          if (parsed) {
            candidates.push(parsed);
          }
        });
      }
    }
  }

  const leRecord = asRecord(record["le"]);
  if (leRecord) {
    const latest = readString(leRecord["LatestVersion"]);
    if (latest) {
      candidates.push(latest);
    }
  }

  const sorted = Array.from(new Set(candidates)).sort((a, b) => compareVersions(a, b));
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function buildVersionsToTry(primary: string | null): string[] {
  const defaults = [
    // keep this list wide for older/newer instances; primary (from /versions) is always tried first.
    "1.90",
    "1.89",
    "1.88",
    "1.87",
    "1.86",
    "1.85",
    "1.84",
    "1.83",
    "1.82",
    "1.81",
    "1.80",
    "1.79",
    "1.78",
    "1.77",
    "1.76",
    "1.75",
    "1.74",
    "1.72",
    "1.71",
    "1.70",
    "1.68",
    "1.65",
    "1.62",
    "1.60",
    "1.58",
    "1.55",
    "1.52",
    "1.50",
    "1.48",
    "1.45",
    "1.42",
    "1.40",
    "1.35",
    "1.30",
    "1.28"
  ];

  const merged = [primary, ...defaults].filter((value): value is string => typeof value === "string");
  const unique = Array.from(new Set(merged));
  return unique.sort((a, b) => compareVersions(b, a));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toDateOrNull(value: unknown): Date | null {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  // Brightspace returns UTCDateTime in most cases. Some fields can be LocalDateTime; interpret
  // date-only-ish values as midnight UTC to reduce drift.
  const dateOnly = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  const normalized = dateOnly ? `${raw}T00:00:00.000Z` : raw.endsWith("Z") ? raw : raw;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readDescriptionText(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const text = readString(record["Text"]);
  if (text) {
    return text;
  }

  const html = readString(record["Html"]);
  if (html) {
    const stripped = stripHtml(html);
    return stripped.length > 0 ? stripped : null;
  }

  return null;
}

function makeTimelineKey(item: { sourceType: string; sourceId: string; dateKind: string }): string {
  return `${item.sourceType}:${item.sourceId}:${item.dateKind}`;
}

function calendarAssocKey(input: {
  orgUnitId: string;
  associatedEntityType: string;
  associatedEntityId: string;
  startAtIso: string;
}): string {
  return `${input.orgUnitId}|${input.associatedEntityType}|${input.associatedEntityId}|${input.startAtIso}`;
}

function safeResolveUrl(instanceUrl: string, maybeRelative: string | null): string | null {
  if (!maybeRelative) {
    return null;
  }

  const raw = maybeRelative.trim();
  if (raw.length === 0) {
    return null;
  }

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }

    return new URL(raw, instanceUrl).toString();
  } catch {
    return null;
  }
}

function normalizeNextApiPath(instanceUrl: string, next: string): string {
  const trimmed = next.trim();
  if (trimmed.startsWith("/d2l/api/")) {
    return trimmed;
  }

  if (trimmed.startsWith("d2l/api/")) {
    return `/${trimmed}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    // ensure it belongs to the same instance to avoid following unexpected hosts
    const instanceHost = new URL(instanceUrl).host.toLowerCase();
    if (url.host.toLowerCase() !== instanceHost) {
      throw new AppError(502, "unexpected pagination host", "calendar_pagination_host_mismatch");
    }

    const path = `${url.pathname}${url.search}`;
    if (!path.startsWith("/d2l/api/")) {
      throw new AppError(502, "unexpected pagination url", "calendar_pagination_invalid_next");
    }

    return path;
  }

  throw new AppError(502, "unexpected pagination url", "calendar_pagination_invalid_next");
}

async function fetchObjectListPage(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  apiPath: string;
}): Promise<{ next: string | null; objects: unknown[] }> {
  const response = await connectorRequest<unknown>({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    apiPath: input.apiPath
  });

  const record = asRecord(response.data);
  if (!record) {
    throw new AppError(502, "calendar api returned unexpected payload", "calendar_invalid_payload");
  }

  const next = readString(record["Next"]);
  const objectsRaw = record["Objects"];

  if (!Array.isArray(objectsRaw)) {
    throw new AppError(502, "calendar api returned unexpected payload", "calendar_invalid_payload");
  }

  return {
    next,
    objects: objectsRaw as unknown[]
  };
}

async function fetchObjectListAll(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  apiPath: string;
}): Promise<unknown[]> {
  let apiPath = input.apiPath;
  const all: unknown[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageResponse = await fetchObjectListPage({
      instanceUrl: input.instanceUrl,
      storageState: input.storageState,
      apiPath
    });

    all.push(...pageResponse.objects);

    if (!pageResponse.next) {
      return all;
    }

    apiPath = normalizeNextApiPath(input.instanceUrl, pageResponse.next);
  }

  throw new AppError(502, "unexpected pagination depth", "pagination_excessive");
}

async function fetchCalendarEventsForChunk(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  leVersion: string;
  orgUnitIds: string[];
  startDateTimeIso: string;
  endDateTimeIso: string;
}): Promise<unknown[]> {
  const params = new URLSearchParams({
    orgUnitIdsCSV: input.orgUnitIds.join(","),
    startDateTime: input.startDateTimeIso,
    endDateTime: input.endDateTimeIso
  });

  const apiPath = `/d2l/api/le/${input.leVersion}/calendar/events/myEvents/?${params.toString()}`;
  return fetchObjectListAll({
    instanceUrl: input.instanceUrl,
    storageState: input.storageState,
    apiPath
  });
}

async function fetchCalendarEventsWithForbiddenSplit(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  leVersion: string;
  orgUnitIds: string[];
  startDateTimeIso: string;
  endDateTimeIso: string;
}): Promise<{ events: unknown[]; forbiddenOrgUnitIds: string[] }> {
  if (input.orgUnitIds.length === 0) {
    return { events: [], forbiddenOrgUnitIds: [] };
  }

  try {
    const events = await fetchCalendarEventsForChunk({
      instanceUrl: input.instanceUrl,
      storageState: input.storageState,
      leVersion: input.leVersion,
      orgUnitIds: input.orgUnitIds,
      startDateTimeIso: input.startDateTimeIso,
      endDateTimeIso: input.endDateTimeIso
    });

    return { events, forbiddenOrgUnitIds: [] };
  } catch (error) {
    // Some Brightspace instances return 403 for the whole request if ANY org unit in orgUnitIdsCSV
    // is forbidden. Split to isolate and skip only the forbidden org unit(s) so calendar sync can
    // still succeed for the rest of the user's courses.
    if (isAppError(error) && error.statusCode === 403) {
      if (input.orgUnitIds.length === 1) {
        return { events: [], forbiddenOrgUnitIds: [...input.orgUnitIds] };
      }

      const mid = Math.ceil(input.orgUnitIds.length / 2);
      const left = await fetchCalendarEventsWithForbiddenSplit({
        ...input,
        orgUnitIds: input.orgUnitIds.slice(0, mid)
      });
      const right = await fetchCalendarEventsWithForbiddenSplit({
        ...input,
        orgUnitIds: input.orgUnitIds.slice(mid)
      });

      return {
        events: [...left.events, ...right.events],
        forbiddenOrgUnitIds: [...left.forbiddenOrgUnitIds, ...right.forbiddenOrgUnitIds]
      };
    }

    throw error;
  }
}

function parseCalendarEvent(raw: unknown): {
  brightspaceEventId: string;
  brightspaceOrgUnitId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  isAllDay: boolean;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
  viewUrl: string | null;
} | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const eventId = readIdentifier(record["CalendarEventId"]);
  const orgUnitId = readIdentifier(record["OrgUnitId"]);
  const title = readString(record["Title"]);

  const startAt =
    toDateOrNull(record["StartDateTime"]) ??
    toDateOrNull(record["StartDay"]) ??
    null;

  if (!eventId || !orgUnitId || !title || !startAt) {
    return null;
  }

  const endAt =
    toDateOrNull(record["EndDateTime"]) ??
    toDateOrNull(record["EndDay"]) ??
    null;

  const description = readString(record["Description"]);
  const isAllDay = record["IsAllDayEvent"] === true;

  const associatedRecord = asRecord(record["AssociatedEntity"]);
  const associatedEntityType = associatedRecord ? readString(associatedRecord["AssociatedEntityType"]) : null;
  const associatedEntityId = associatedRecord ? readIdentifier(associatedRecord["AssociatedEntityId"]) : null;

  const calendarViewUrl = readString(record["CalendarEventViewUrl"]);
  const associatedLink = associatedRecord ? readString(associatedRecord["Link"]) : null;
  // Prefer the associated entity deep link (dropbox/quiz/content) over the calendar details view.
  const viewUrl = associatedLink ?? calendarViewUrl;

  return {
    brightspaceEventId: eventId,
    brightspaceOrgUnitId: orgUnitId,
    title,
    description,
    startAt,
    endAt,
    isAllDay,
    associatedEntityType,
    associatedEntityId,
    viewUrl
  };
}

function addToolDates(input: {
  drafts: TimelineDraft[];
  sourceType: SourceType;
  sourceId: string;
  orgUnitId: string;
  title: string;
  description: string | null;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
  viewUrl: string | null;
  rawData: unknown;
  startAt: Date | null;
  dueAt: Date | null;
  endAt: Date | null;
  isAllDay?: boolean;
}): void {
  const isAllDay = input.isAllDay === true;

  const push = (dateKind: DateKind, when: Date | null) => {
    if (!when) {
      return;
    }

    input.drafts.push({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dateKind,
      brightspaceOrgUnitId: input.orgUnitId,
      title: input.title,
      description: input.description,
      startAt: when,
      endAt: null,
      isAllDay,
      associatedEntityType: input.associatedEntityType,
      associatedEntityId: input.associatedEntityId,
      viewUrl: input.viewUrl,
      rawData: input.rawData
    });
  };

  push("start", input.startAt);
  push("due", input.dueAt);
  push("end", input.endAt);
}

function listPayloadToArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const objects = record["Objects"];
  if (Array.isArray(objects)) {
    return objects;
  }

  return [];
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  fn: (item: TItem, index: number) => Promise<TResult>
): Promise<TResult[]> {
  const concurrency = Math.max(1, limit);
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index] as TItem, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const syncCalendarRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/sync/calendar",
    {
      preHandler: fastify.requireAuth
    },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const user = request.auth.user;
      if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
        throw new AppError(400, "connect to d2l before syncing calendar", "not_connected");
      }

      // Snapshot to a non-null string for TS narrowing (property access isn't reliably narrowed across awaits/closures).
      const instanceUrl = user.institutionUrl;

      const activeCourses = await prisma.course.findMany({
        where: {
          userId: user.id,
          isActive: true
        },
        select: {
          id: true,
          brightspaceCourseId: true
        }
      });

      if (activeCourses.length === 0) {
        throw new AppError(400, "sync courses first", "no_courses");
      }

      const storageState = decodeStorageState(user.brightspaceStateEncrypted);
      const now = new Date();

      // window: start of month 3 months ago through end of month 18 months out (UTC)
      const currentUtcYear = now.getUTCFullYear();
      const currentUtcMonth = now.getUTCMonth();

      const startMonthIndex = currentUtcMonth - 3;
      const startYear = currentUtcYear + Math.floor(startMonthIndex / 12);
      const startMonth = ((startMonthIndex % 12) + 12) % 12;
      const windowStart = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0));

      const endMonthIndex = currentUtcMonth + 18;
      const endYear = currentUtcYear + Math.floor(endMonthIndex / 12);
      const endMonth = ((endMonthIndex % 12) + 12) % 12;
      const windowEnd = new Date(Date.UTC(endYear, endMonth + 1, 0, 23, 59, 59, 999));

      try {
        const courseIdByOrgUnitId = new Map(
          activeCourses.map((course) => [course.brightspaceCourseId, course.id] as const)
        );

        const orgUnitIds = activeCourses.map((course) => course.brightspaceCourseId);
        const orgUnitChunks = chunkArray(orgUnitIds, ORG_UNIT_CHUNK_SIZE);

        const versionsResponse = await connectorRequest<unknown>({
          instanceUrl,
          storageState,
          apiPath: "/d2l/api/versions/"
        });

        const latestLeVersion = findLatestLeVersion(versionsResponse.data);
        const versionsToTry = buildVersionsToTry(latestLeVersion);

        let selectedLeVersion: string | null = null;

        // Find a working LE version. Some instances return 403 for calendar depending on course
        // permissions; 403 still indicates the endpoint exists for that version.
        for (const version of versionsToTry) {
          try {
            const probeOrgUnitId = orgUnitIds[0];
            if (!probeOrgUnitId) {
              break;
            }

            await fetchCalendarEventsForChunk({
              instanceUrl,
              storageState,
              leVersion: version,
              orgUnitIds: [probeOrgUnitId],
              startDateTimeIso: windowStart.toISOString(),
              endDateTimeIso: windowEnd.toISOString()
            });

            selectedLeVersion = version;
            break;
          } catch (error) {
            if (isAppError(error) && error.statusCode === 404) {
              continue;
            }

            if (isAppError(error) && error.statusCode === 403) {
              selectedLeVersion = version;
              break;
            }

            throw error;
          }
        }

        if (!selectedLeVersion) {
          throw new AppError(502, "calendar api unavailable on this instance", "calendar_api_unavailable");
        }

        // 1) Fetch ALL Brightspace calendar events (all event types, include unassociated).
        const allRawCalendarEvents: unknown[] = [];
        const forbiddenOrgUnitIds: string[] = [];

        for (let index = 0; index < orgUnitChunks.length; index += 1) {
          const chunk = orgUnitChunks[index] ?? [];
          if (chunk.length === 0) {
            continue;
          }

          const chunkResult = await fetchCalendarEventsWithForbiddenSplit({
            instanceUrl,
            storageState,
            leVersion: selectedLeVersion,
            orgUnitIds: chunk,
            startDateTimeIso: windowStart.toISOString(),
            endDateTimeIso: windowEnd.toISOString()
          });

          allRawCalendarEvents.push(...chunkResult.events);
          forbiddenOrgUnitIds.push(...chunkResult.forbiddenOrgUnitIds);
        }

        const forbiddenSet = new Set(forbiddenOrgUnitIds);
        const syncedOrgUnitIds = orgUnitIds.filter((id) => !forbiddenSet.has(id));

        const calendarAssocKeys = new Set<string>();
        const draftsByKey = new Map<string, TimelineDraft>();
        const countsBySource: Record<string, number> = Object.create(null);
        const unassociatedCalendarIndex = new Map<string, string>();
        let duplicatesSkipped = 0;

        function timeTitleKey(input: { orgUnitId: string; startAt: Date; title: string }): string {
          return `${input.orgUnitId}|${input.startAt.toISOString()}|${input.title.trim().toLowerCase()}`;
        }

        function addDraft(draft: TimelineDraft, options?: { allowDedupeAgainstCalendar?: boolean }) {
          // keep everything within the window we asked for
          if (draft.startAt.getTime() < windowStart.getTime() || draft.startAt.getTime() > windowEnd.getTime()) {
            return;
          }

          // If a tool-derived due date matches an unassociated calendar event (same time+title), prefer the tool event.
          // This prevents "OTHER" calendar events from hiding the richer overview CTAs for Dropbox/Content/Quizzes.
          if (
            draft.sourceType !== "calendar" &&
            (draft.sourceType === "dropbox_folder" || draft.sourceType === "quiz" || draft.sourceType === "content_topic") &&
            draft.dateKind === "due"
          ) {
            const key = timeTitleKey({
              orgUnitId: draft.brightspaceOrgUnitId,
              startAt: draft.startAt,
              title: draft.title
            });
            const calendarDraftKey = unassociatedCalendarIndex.get(key);
            if (calendarDraftKey && draftsByKey.delete(calendarDraftKey)) {
              unassociatedCalendarIndex.delete(key);
              countsBySource["calendar"] = Math.max(0, (countsBySource["calendar"] ?? 0) - 1);
              duplicatesSkipped += 1;
            }
          }

          if (
            options?.allowDedupeAgainstCalendar !== false &&
            draft.associatedEntityType &&
            draft.associatedEntityId
          ) {
            const assocKey = calendarAssocKey({
              orgUnitId: draft.brightspaceOrgUnitId,
              associatedEntityType: draft.associatedEntityType,
              associatedEntityId: draft.associatedEntityId,
              startAtIso: draft.startAt.toISOString()
            });

            if (calendarAssocKeys.has(assocKey) && draft.sourceType !== "calendar") {
              duplicatesSkipped += 1;
              return;
            }
          }

          const key = makeTimelineKey(draft);
          if (draftsByKey.has(key)) {
            duplicatesSkipped += 1;
            return;
          }

          draftsByKey.set(key, draft);
          countsBySource[draft.sourceType] = (countsBySource[draft.sourceType] ?? 0) + 1;
        }

        // calendar drafts + dedupe keys
        for (const raw of allRawCalendarEvents) {
          const parsed = parseCalendarEvent(raw);
          if (!parsed) {
            continue;
          }

          if (forbiddenSet.has(parsed.brightspaceOrgUnitId)) {
            continue;
          }

          const draft: TimelineDraft = {
            sourceType: "calendar",
            sourceId: parsed.brightspaceEventId,
            dateKind: "event",
            brightspaceOrgUnitId: parsed.brightspaceOrgUnitId,
            title: parsed.title,
            description: parsed.description,
            startAt: parsed.startAt,
            endAt: parsed.endAt,
            isAllDay: parsed.isAllDay,
            associatedEntityType: parsed.associatedEntityType,
            associatedEntityId: parsed.associatedEntityId,
            viewUrl: parsed.viewUrl,
            rawData: raw
          };

          addDraft(draft, { allowDedupeAgainstCalendar: false });

          if (parsed.associatedEntityType && parsed.associatedEntityId) {
            calendarAssocKeys.add(
              calendarAssocKey({
                orgUnitId: parsed.brightspaceOrgUnitId,
                associatedEntityType: parsed.associatedEntityType,
                associatedEntityId: parsed.associatedEntityId,
                startAtIso: parsed.startAt.toISOString()
              })
            );
          } else {
            // Index unassociated calendar events for possible replacement by tool-derived due dates.
            const insertedKey = makeTimelineKey(draft);
            if (draftsByKey.has(insertedKey)) {
              unassociatedCalendarIndex.set(
                timeTitleKey({
                  orgUnitId: parsed.brightspaceOrgUnitId,
                  startAt: parsed.startAt,
                  title: parsed.title
                }),
                insertedKey
              );
            }
          }
        }

        const instanceOrigin = new URL(instanceUrl).origin;

        // 2) Deep dig: Content, Dropbox, Quizzes, Discussions, Checklists (per org unit).
        await mapWithConcurrency(syncedOrgUnitIds, 4, async (orgUnitId) => {
          const contentHome = `${instanceOrigin}/d2l/le/content/${encodeURIComponent(orgUnitId)}/Home`;

          // Content root (modules)
          try {
            const rootResponse = await connectorRequest<unknown>({
              instanceUrl,
              storageState,
              apiPath: `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/content/root/`
            });

            const modules = listPayloadToArray(rootResponse.data).map(asRecord).filter(Boolean) as Record<string, unknown>[];
            for (const module of modules) {
              const moduleId = readIdentifier(module["Id"]);
              const title = readString(module["Title"]) ?? "content module";
              if (!moduleId) {
                continue;
              }

              const description =
                readDescriptionText(module["Description"]) ??
                null;

              const drafts: TimelineDraft[] = [];
              addToolDates({
                drafts,
                sourceType: "content_module",
                sourceId: moduleId,
                orgUnitId,
                title: `Module: ${title}`,
                description,
                associatedEntityType: null,
                associatedEntityId: null,
                viewUrl: contentHome,
                rawData: module,
                startAt: toDateOrNull(module["ModuleStartDate"]),
                dueAt: toDateOrNull(module["ModuleDueDate"]),
                endAt: toDateOrNull(module["ModuleEndDate"])
              });
              drafts.forEach((draft) => addDraft(draft));
            }

            // Fetch module structures (topics) with limited concurrency.
            const moduleIds = modules
              .map((module) => readIdentifier(module["Id"]))
              .filter((id): id is string => typeof id === "string");

            await mapWithConcurrency(moduleIds, 3, async (moduleId) => {
              try {
                const structResponse = await connectorRequest<unknown>({
                  instanceUrl,
                  storageState,
                  apiPath: `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/content/modules/${moduleId}/structure/`
                });

                const items = listPayloadToArray(structResponse.data).map(asRecord).filter(Boolean) as Record<string, unknown>[];

                for (const item of items) {
                  const topicId = readIdentifier(item["Id"]);
                  const title = readString(item["Title"]) ?? "content item";
                  if (!topicId) {
                    continue;
                  }

                  const dueAt = toDateOrNull(item["DueDate"]);
                  const startAt = toDateOrNull(item["StartDate"]);
                  const endAt = toDateOrNull(item["EndDate"]);

                  if (!dueAt && !startAt && !endAt) {
                    continue;
                  }

                  const description = readDescriptionText(item["Description"]);
                  const urlRaw = readString(item["Url"]);
                  const viewUrl =
                    safeResolveUrl(instanceUrl, urlRaw) ??
                    `${instanceOrigin}/d2l/le/content/${encodeURIComponent(orgUnitId)}/viewContent/${encodeURIComponent(
                      topicId
                    )}/View`;

                  const drafts: TimelineDraft[] = [];
                  addToolDates({
                    drafts,
                    sourceType: "content_topic",
                    sourceId: topicId,
                    orgUnitId,
                    title,
                    description,
                    associatedEntityType: "D2L.LE.Content.ContentObject.TopicCO",
                    associatedEntityId: topicId,
                    viewUrl,
                    rawData: item,
                    startAt,
                    dueAt,
                    endAt
                  });

                  drafts.forEach((draft) => addDraft(draft));
                }
              } catch (error) {
                // structure isn't guaranteed; skip on 404/403
                if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
                  return;
                }
                throw error;
              }
            });
          } catch (error) {
            if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
              // content api not available for this org unit/role
            } else {
              throw error;
            }
          }

          // Dropbox folders
          try {
            const apiPath = `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/dropbox/folders/`;
            const first = await connectorRequest<unknown>({
              instanceUrl,
              storageState,
              apiPath
            });

            const record = asRecord(first.data);
            const foldersRaw = record && Array.isArray(record["Objects"])
              ? await fetchObjectListAll({ instanceUrl, storageState, apiPath })
              : listPayloadToArray(first.data);

            const folders = foldersRaw.map(asRecord).filter(Boolean) as Record<string, unknown>[];
            for (const folder of folders) {
              const folderId = readIdentifier(folder["Id"]) ?? readIdentifier(folder["FolderId"]);
              const title = readString(folder["Name"]) ?? readString(folder["Title"]) ?? "dropbox";
              if (!folderId) {
                continue;
              }

              const availability = asRecord(folder["Availability"]);
              const startAt = availability ? toDateOrNull(availability["StartDate"]) : null;
              const endAt = availability ? toDateOrNull(availability["EndDate"]) : null;
              const dueAt = toDateOrNull(folder["DueDate"]);

              if (!dueAt && !startAt && !endAt) {
                continue;
              }

              const viewUrl = `${instanceOrigin}/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=${encodeURIComponent(
                orgUnitId
              )}&db=${encodeURIComponent(folderId)}`;

              const drafts: TimelineDraft[] = [];
              addToolDates({
                drafts,
                sourceType: "dropbox_folder",
                sourceId: folderId,
                orgUnitId,
                title,
                description: null,
                associatedEntityType: "D2L.LE.Dropbox.Dropbox",
                associatedEntityId: folderId,
                viewUrl,
                rawData: folder,
                startAt,
                dueAt,
                endAt
              });

              drafts.forEach((draft) => addDraft(draft));
            }
          } catch (error) {
            if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
              // dropbox not available
            } else {
              throw error;
            }
          }

          // Quizzes
          try {
            const quizzes = await fetchObjectListAll({
              instanceUrl,
              storageState,
              apiPath: `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/quizzes/`
            });

            const quizRecords = quizzes.map(asRecord).filter(Boolean) as Record<string, unknown>[];
            for (const quiz of quizRecords) {
              const quizId = readIdentifier(quiz["QuizId"]) ?? readIdentifier(quiz["Id"]);
              const title = readString(quiz["Name"]) ?? "quiz";
              if (!quizId) {
                continue;
              }

              const dueAt = toDateOrNull(quiz["DueDate"]);
              const startAt = toDateOrNull(quiz["StartDate"]);
              const endAt = toDateOrNull(quiz["EndDate"]);

              if (!dueAt && !startAt && !endAt) {
                continue;
              }

              const viewUrl = `${instanceOrigin}/d2l/lms/quizzing/quizzing.d2l?ou=${encodeURIComponent(
                orgUnitId
              )}&qi=${encodeURIComponent(quizId)}`;

              const drafts: TimelineDraft[] = [];
              addToolDates({
                drafts,
                sourceType: "quiz",
                sourceId: quizId,
                orgUnitId,
                title,
                description:
                  readDescriptionText(quiz["Description"]) ??
                  readDescriptionText(quiz["Instructions"]) ??
                  null,
                associatedEntityType: "D2L.LE.Quizzing.Quiz",
                associatedEntityId: quizId,
                viewUrl,
                rawData: quiz,
                startAt,
                dueAt,
                endAt
              });

              drafts.forEach((draft) => addDraft(draft));
            }
          } catch (error) {
            if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
              // quizzes not available
            } else {
              throw error;
            }
          }

          // Discussions (forums + topics optional)
          try {
            const forumsResponse = await connectorRequest<unknown>({
              instanceUrl,
              storageState,
              apiPath: `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/discussions/forums/`
            });

            const forums = listPayloadToArray(forumsResponse.data).map(asRecord).filter(Boolean) as Record<string, unknown>[];
            for (const forum of forums) {
              const forumId = readIdentifier(forum["ForumId"]) ?? readIdentifier(forum["Id"]);
              const name = readString(forum["Name"]) ?? "discussion forum";
              if (!forumId) {
                continue;
              }

              const startAt = toDateOrNull(forum["StartDate"]);
              const endAt = toDateOrNull(forum["EndDate"]);
              const postStart = toDateOrNull(forum["PostStartDate"]);
              const postEnd = toDateOrNull(forum["PostEndDate"]);
              const description = readDescriptionText(forum["Description"]);

              if (startAt || endAt) {
                const drafts: TimelineDraft[] = [];
                addToolDates({
                  drafts,
                  sourceType: "discussion_forum",
                  sourceId: forumId,
                  orgUnitId,
                  title: `Forum: ${name}`,
                  description,
                  associatedEntityType: null,
                  associatedEntityId: null,
                  viewUrl: null,
                  rawData: forum,
                  startAt,
                  dueAt: null,
                  endAt
                });
                drafts.forEach((draft) => addDraft(draft));
              }

              // Post window (keep separate sourceId to avoid clobbering Start/End).
              if (postStart || postEnd) {
                const drafts: TimelineDraft[] = [];
                addToolDates({
                  drafts,
                  sourceType: "discussion_forum",
                  sourceId: `${forumId}:post`,
                  orgUnitId,
                  title: `Forum: ${name} (posting window)`,
                  description,
                  associatedEntityType: null,
                  associatedEntityId: null,
                  viewUrl: null,
                  rawData: forum,
                  startAt: postStart,
                  dueAt: null,
                  endAt: postEnd
                });
                drafts.forEach((draft) => addDraft(draft));
              }

              // Optional: topics list
              try {
                const topicsResponse = await connectorRequest<unknown>({
                  instanceUrl,
                  storageState,
                  apiPath: `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/discussions/forums/${encodeURIComponent(
                    forumId
                  )}/topics/`
                });

                const topics = listPayloadToArray(topicsResponse.data).map(asRecord).filter(Boolean) as Record<string, unknown>[];
                for (const topic of topics) {
                  const topicId = readIdentifier(topic["TopicId"]) ?? readIdentifier(topic["Id"]);
                  const topicName = readString(topic["Name"]) ?? "discussion topic";
                  if (!topicId) {
                    continue;
                  }

                  const tStart = toDateOrNull(topic["StartDate"]);
                  const tEnd = toDateOrNull(topic["EndDate"]);
                  const tDue = toDateOrNull(topic["DueDate"]);

                  if (!tStart && !tEnd && !tDue) {
                    continue;
                  }

                  const drafts: TimelineDraft[] = [];
                  addToolDates({
                    drafts,
                    sourceType: "discussion_topic",
                    sourceId: topicId,
                    orgUnitId,
                    title: `Topic: ${topicName}`,
                    description: readDescriptionText(topic["Description"]) ?? null,
                    associatedEntityType: null,
                    associatedEntityId: null,
                    viewUrl: null,
                    rawData: topic,
                    startAt: tStart,
                    dueAt: tDue,
                    endAt: tEnd
                  });
                  drafts.forEach((draft) => addDraft(draft));
                }
              } catch (error) {
                if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
                  // ignore
                } else {
                  throw error;
                }
              }
            }
          } catch (error) {
            if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
              // discussions not available
            } else {
              throw error;
            }
          }

          // Checklists (best-effort, may be empty or unsupported)
          try {
            const checklists = await fetchObjectListAll({
              instanceUrl,
              storageState,
              apiPath: `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/checklists/`
            });

            const checklistRecords = checklists.map(asRecord).filter(Boolean) as Record<string, unknown>[];
            const checklistIds = checklistRecords
              .map((checklist) => readIdentifier(checklist["ChecklistId"]) ?? readIdentifier(checklist["Id"]))
              .filter((id): id is string => typeof id === "string");

            await mapWithConcurrency(checklistIds, 4, async (checklistId) => {
              const candidates = [
                `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/checklists/${encodeURIComponent(checklistId)}/items/`,
                `/d2l/api/le/${selectedLeVersion}/${orgUnitId}/checklists/${encodeURIComponent(checklistId)}/items`
              ];

              for (const apiPath of candidates) {
                try {
                  const resp = await connectorRequest<unknown>({
                    instanceUrl,
                    storageState,
                    apiPath
                  });

                  const items = listPayloadToArray(resp.data).map(asRecord).filter(Boolean) as Record<string, unknown>[];
                  for (const item of items) {
                    const itemId = readIdentifier(item["ChecklistItemId"]) ?? readIdentifier(item["Id"]);
                    const name = readString(item["Name"]) ?? readString(item["Title"]) ?? "checklist item";
                    if (!itemId) {
                      continue;
                    }

                    const dueAt =
                      toDateOrNull(item["DueDate"]) ??
                      toDateOrNull(item["CompletionDueDate"]) ??
                      null;

                    if (!dueAt) {
                      continue;
                    }

                    const drafts: TimelineDraft[] = [];
                    addToolDates({
                      drafts,
                      sourceType: "checklist",
                      sourceId: `${checklistId}:${itemId}`,
                      orgUnitId,
                      title: `Checklist: ${name}`,
                      description: readDescriptionText(item["Description"]) ?? null,
                      associatedEntityType: null,
                      associatedEntityId: null,
                      viewUrl: null,
                      rawData: item,
                      startAt: null,
                      dueAt,
                      endAt: null
                    });
                    drafts.forEach((draft) => addDraft(draft));
                  }

                  return;
                } catch (error) {
                  if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
                    continue;
                  }
                  throw error;
                }
              }
            });
          } catch (error) {
            if (isAppError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
              // checklists not available
            } else {
              throw error;
            }
          }
        });

        const drafts = Array.from(draftsByKey.values());

        // Upsert into timeline_events
        const concurrency = 20;
        let cursor = 0;
        let upserted = 0;

        async function worker() {
          while (cursor < drafts.length) {
            const index = cursor;
            cursor += 1;
            const draft = drafts[index];
            if (!draft) {
              continue;
            }

            const courseId = courseIdByOrgUnitId.get(draft.brightspaceOrgUnitId) ?? null;

            await prisma.timelineEvent.upsert({
              where: {
                userId_sourceType_sourceId_dateKind: {
                  userId: user.id,
                  sourceType: draft.sourceType,
                  sourceId: draft.sourceId,
                  dateKind: draft.dateKind
                }
              },
              update: {
                courseId,
                brightspaceOrgUnitId: draft.brightspaceOrgUnitId,
                title: draft.title,
                description: draft.description,
                startAt: draft.startAt,
                endAt: draft.endAt,
                isAllDay: draft.isAllDay,
                associatedEntityType: draft.associatedEntityType,
                associatedEntityId: draft.associatedEntityId,
                viewUrl: draft.viewUrl,
                rawData: draft.rawData as Prisma.InputJsonValue,
                lastSyncedAt: now
              },
              create: {
                userId: user.id,
                courseId,
                brightspaceOrgUnitId: draft.brightspaceOrgUnitId,
                sourceType: draft.sourceType,
                sourceId: draft.sourceId,
                dateKind: draft.dateKind,
                title: draft.title,
                description: draft.description,
                startAt: draft.startAt,
                endAt: draft.endAt,
                isAllDay: draft.isAllDay,
                associatedEntityType: draft.associatedEntityType,
                associatedEntityId: draft.associatedEntityId,
                viewUrl: draft.viewUrl,
                rawData: draft.rawData as Prisma.InputJsonValue,
                lastSyncedAt: now
              }
            });

            upserted += 1;
          }
        }

        const workers = Array.from({ length: Math.min(concurrency, drafts.length) }, () => worker());
        await Promise.all(workers);

        const fetchedKeys = new Set(drafts.map((draft) => makeTimelineKey(draft)));

        const existing = await prisma.timelineEvent.findMany({
          where: {
            userId: user.id,
            brightspaceOrgUnitId: {
              in: syncedOrgUnitIds
            },
            startAt: {
              gte: windowStart,
              lte: windowEnd
            }
          },
          select: {
            id: true,
            sourceType: true,
            sourceId: true,
            dateKind: true
          }
        });

        const staleIds: string[] = [];
        for (const row of existing) {
          const key = makeTimelineKey(row);
          if (!fetchedKeys.has(key)) {
            staleIds.push(row.id);
          }
        }

        let deletedCount = 0;
        for (let i = 0; i < staleIds.length; i += 500) {
          const slice = staleIds.slice(i, i + 500);
          const deleted = await prisma.timelineEvent.deleteMany({
            where: {
              id: {
                in: slice
              }
            }
          });
          deletedCount += deleted.count;
        }

        await prisma.syncLog.create({
          data: {
            userId: user.id,
            syncType: "calendar",
            status: forbiddenOrgUnitIds.length > 0 ? "partial" : "success",
            itemsSynced: drafts.length
          }
        });

        return {
          success: true,
          eventsFetched: drafts.length,
          eventsUpserted: upserted,
          eventsDeleted: deletedCount,
          orgUnitsForbidden: forbiddenOrgUnitIds,
          duplicatesSkipped,
          countsBySource,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          syncedAt: now.toISOString()
        };
      } catch (error) {
        await prisma.syncLog
          .create({
            data: {
              userId: user.id,
              syncType: "calendar",
              status: "failed",
              itemsSynced: 0,
              errorMessage: safeErrorMessage(error)
            }
          })
          .catch(() => undefined);

        if (isAppError(error) && error.code === "session_expired") {
          throw new AppError(401, "session expired", "session_expired");
        }

        if (isAppError(error) && error.statusCode === 403) {
          throw new AppError(403, "calendar data unavailable for this role", "calendar_forbidden");
        }

        throw error;
      }
    }
  );
};

export default syncCalendarRoute;
