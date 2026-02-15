import type { ConnectorRequestResponse } from "./types.js";

import { connectorRequest } from "./connectorClient.js";
import { AppError } from "./errors.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

export async function getWorkingLeVersion(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  // A known-good apiPath to probe; must return 2xx when the LE version is correct.
  probeApiPath: (version: string) => string;
}): Promise<string> {
  let versionsResponse: ConnectorRequestResponse<unknown>;

  try {
    versionsResponse = await connectorRequest<unknown>({
      instanceUrl: input.instanceUrl,
      storageState: input.storageState,
      apiPath: "/d2l/api/versions/"
    });
  } catch (error) {
    throw new AppError(502, "could not determine brightspace api version", "d2l_versions_unavailable");
  }

  const latest = findLatestLeVersion(versionsResponse.data);
  const toTry = buildVersionsToTry(latest);

  for (const version of toTry) {
    try {
      await connectorRequest<unknown>({
        instanceUrl: input.instanceUrl,
        storageState: input.storageState,
        apiPath: input.probeApiPath(version)
      });
      return version;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        continue;
      }
      // Any other error means version exists but request failed; return version so caller can handle.
      return version;
    }
  }

  throw new AppError(502, "brightspace le api unavailable", "d2l_versions_unavailable");
}
