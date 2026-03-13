import { connectorRequest } from "./connectorClient.js";
import { isAppError } from "./errors.js";

type JsonRecord = Record<string, unknown>;

export type DropboxSubmissionState = "submitted" | "not_submitted" | "unknown";

export interface DropboxSubmissionStatus {
  orgUnitId: string;
  folderId: string;
  state: DropboxSubmissionState;
  hasSubmission: boolean;
  latestSubmissionAt: string | null;
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  mapper: (item: TItem) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: safeLimit }, async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapper(items[currentIndex] as TItem);
      }
    })
  );

  return results;
}

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
    "1.77"
  ];

  const merged = [primary, ...defaults].filter((value): value is string => typeof value === "string");
  const unique = Array.from(new Set(merged));
  return unique.sort((a, b) => compareVersions(b, a));
}

function toEntityDropboxArray(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter(Boolean) as JsonRecord[];
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  if (Array.isArray(record["Objects"])) {
    return (record["Objects"] as unknown[]).map(asRecord).filter(Boolean) as JsonRecord[];
  }

  return [record];
}

function extractLatestSubmissionAt(entity: JsonRecord | null): string | null {
  if (!entity) {
    return null;
  }

  const submissionsRaw = entity["Submissions"];
  if (!Array.isArray(submissionsRaw)) {
    return null;
  }

  let latest: string | null = null;

  for (const submissionRaw of submissionsRaw) {
    const submission = asRecord(submissionRaw);
    const submittedAt = submission ? readString(submission["SubmissionDate"]) : null;
    if (!submittedAt) {
      continue;
    }

    if (!latest || submittedAt > latest) {
      latest = submittedAt;
    }
  }

  return latest;
}

function hasSubmission(entity: JsonRecord | null): boolean {
  if (!entity) {
    return false;
  }

  const submissionsRaw = entity["Submissions"];
  return Array.isArray(submissionsRaw) && submissionsRaw.length > 0;
}

function buildStatus(input: {
  orgUnitId: string;
  folderId: string;
  entity: JsonRecord | null;
  state: DropboxSubmissionState;
}): DropboxSubmissionStatus {
  const latestSubmissionAt = extractLatestSubmissionAt(input.entity);
  const submitted = hasSubmission(input.entity);

  return {
    orgUnitId: input.orgUnitId,
    folderId: input.folderId,
    state: input.state === "unknown" ? "unknown" : submitted ? "submitted" : "not_submitted",
    hasSubmission: submitted,
    latestSubmissionAt
  };
}

function parseForCurrentUser(input: {
  payload: unknown;
  orgUnitId: string;
  folderId: string;
  brightspaceUserId?: string | null;
  mode: "mysubmissions" | "user" | "all";
}): DropboxSubmissionStatus {
  const entities = toEntityDropboxArray(input.payload);

  if (input.mode === "mysubmissions") {
    const entity = entities[0] ?? null;
    return buildStatus({
      orgUnitId: input.orgUnitId,
      folderId: input.folderId,
      entity,
      state: entities.length > 0 ? "submitted" : "not_submitted"
    });
  }

  if (input.mode === "user") {
    const entity = entities[0] ?? null;
    return buildStatus({
      orgUnitId: input.orgUnitId,
      folderId: input.folderId,
      entity,
      state: entity ? "submitted" : "not_submitted"
    });
  }

  const matchedEntity = entities.find((entity) => {
    const entityInfo = asRecord(entity["Entity"]);
    return readIdentifier(entityInfo?.["EntityId"]) === input.brightspaceUserId;
  }) ?? null;

  if (input.brightspaceUserId) {
    return buildStatus({
      orgUnitId: input.orgUnitId,
      folderId: input.folderId,
      entity: matchedEntity,
      state: matchedEntity ? "submitted" : "not_submitted"
    });
  }

  return buildStatus({
    orgUnitId: input.orgUnitId,
    folderId: input.folderId,
    entity: null,
    state: "unknown"
  });
}

export async function fetchDropboxSubmissionStatus(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  brightspaceUserId?: string | null;
  orgUnitId: string;
  folderId: string;
}): Promise<DropboxSubmissionStatus> {
  try {
    const versionsResponse = await connectorRequest<unknown>({
      instanceUrl: input.instanceUrl,
      storageState: input.storageState,
      apiPath: "/d2l/api/versions/"
    });

    const latestLeVersion = findLatestLeVersion(versionsResponse.data);
    const versionsToTry = buildVersionsToTry(latestLeVersion);

    for (const version of versionsToTry) {
      const paths: Array<{ mode: "mysubmissions" | "user" | "all"; apiPath: string }> = [
        {
          mode: "mysubmissions",
          apiPath: `/d2l/api/le/${version}/${input.orgUnitId}/dropbox/folders/${input.folderId}/submissions/mysubmissions/`
        }
      ];

      if (input.brightspaceUserId) {
        paths.push({
          mode: "user",
          apiPath: `/d2l/api/le/${version}/${input.orgUnitId}/dropbox/folders/${input.folderId}/submissions/user/${input.brightspaceUserId}?ignoreFeedback=true`
        });
      }

      paths.push({
        mode: "all",
        apiPath: `/d2l/api/le/${version}/${input.orgUnitId}/dropbox/folders/${input.folderId}/submissions/?activeOnly=true`
      });

      for (const path of paths) {
        try {
          const response = await connectorRequest<unknown>({
            instanceUrl: input.instanceUrl,
            storageState: input.storageState,
            apiPath: path.apiPath
          });

          return parseForCurrentUser({
            payload: response.data,
            orgUnitId: input.orgUnitId,
            folderId: input.folderId,
            brightspaceUserId: input.brightspaceUserId,
            mode: path.mode
          });
        } catch (error) {
          if (isAppError(error) && error.code === "session_expired") {
            throw error;
          }

          if (
            isAppError(error) &&
            (error.statusCode === 403 || error.statusCode === 404 || error.statusCode === 429)
          ) {
            continue;
          }

          if (isAppError(error) && error.statusCode >= 500) {
            continue;
          }

          throw error;
        }
      }
    }
  } catch (error) {
    if (isAppError(error) && error.code === "session_expired") {
      throw error;
    }
  }

  return {
    orgUnitId: input.orgUnitId,
    folderId: input.folderId,
    state: "unknown",
    hasSubmission: false,
    latestSubmissionAt: null
  };
}

export async function fetchDropboxSubmissionStatusesBatch(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  brightspaceUserId?: string | null;
  items: Array<{ orgUnitId: string; folderId: string }>;
  concurrency?: number;
}): Promise<DropboxSubmissionStatus[]> {
  const uniqueItems = Array.from(
    new Map(input.items.map((item) => [`${item.orgUnitId}:${item.folderId}`, item] as const)).values()
  );

  return mapWithConcurrency(uniqueItems, input.concurrency ?? 4, (item) =>
    fetchDropboxSubmissionStatus({
      instanceUrl: input.instanceUrl,
      storageState: input.storageState,
      brightspaceUserId: input.brightspaceUserId,
      orgUnitId: item.orgUnitId,
      folderId: item.folderId
    })
  );
}
