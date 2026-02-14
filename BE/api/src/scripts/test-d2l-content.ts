import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { connectorRequest } from "../lib/connectorClient.js";
import { AppError } from "../lib/errors.js";
import { decodeStorageState } from "../lib/storageState.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`missing env var: ${name}`);
  }

  return value.trim();
}

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

  const le = record["le"];
  const leRecord = asRecord(le);
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

function summarizeContent(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload)) {
    const first = payload[0];
    const firstRecord = asRecord(first);

    let moduleId: number | null = null;
    if (firstRecord) {
      moduleId =
        readNumber(firstRecord["ModuleId"]) ??
        readNumber(firstRecord["Id"]) ??
        readNumber(firstRecord["TopicId"]) ??
        null;
    }

    return {
      kind: "array",
      length: payload.length,
      firstItemKeys: firstRecord ? Object.keys(firstRecord).slice(0, 20) : null,
      firstItemId: moduleId
    };
  }

  const record = asRecord(payload);
  if (!record) {
    return { kind: typeof payload };
  }

  const modules = record["Modules"];
  if (Array.isArray(modules)) {
    const titles = modules
      .map((module) => {
        const moduleRecord = asRecord(module);
        if (!moduleRecord) {
          return null;
        }

        return (
          readString(moduleRecord["Title"]) ??
          readString(moduleRecord["Name"]) ??
          readString(moduleRecord["TopicName"]) ??
          null
        );
      })
      .filter((title): title is string => typeof title === "string");

    return {
      kind: "modules",
      moduleCount: modules.length,
      sampleTitles: titles.slice(0, 5)
    };
  }

  return {
    kind: "object",
    keys: Object.keys(record).slice(0, 20)
  };
}

async function main() {
  const email = requiredEnv("TEST_USER_EMAIL");
  const orgUnitIdOverride = readString(process.env.TEST_ORG_UNIT_ID) ?? null;
  const courseQuery = (readString(process.env.TEST_COURSE_QUERY) ?? "pd").toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email
    },
    include: {
      courses: true
    }
  });

  if (!user) {
    throw new Error("no user found for provided email (connect first)");
  }

  if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
    throw new Error("user is not connected (connect first)");
  }

  const storageState = decodeStorageState(user.brightspaceStateEncrypted);

  const course = orgUnitIdOverride
    ? user.courses.find((candidate) => candidate.brightspaceCourseId === orgUnitIdOverride) ?? null
    : user.courses.find((candidate) => {
        const haystack = `${candidate.courseCode ?? ""} ${candidate.courseName}`.toLowerCase();
        return haystack.includes(courseQuery);
      }) ?? null;

  if (!course) {
    throw new Error("no matching course found (run sync courses first)");
  }

  const orgUnitId = course.brightspaceCourseId;

  const versionsResponse = await connectorRequest<unknown>({
    instanceUrl: user.institutionUrl,
    storageState,
    apiPath: "/d2l/api/versions/"
  });

  const latestLeVersion = findLatestLeVersion(versionsResponse.data);
  const versionsToTry = buildVersionsToTry(latestLeVersion);

  for (const version of versionsToTry) {
    try {
      const contentResponse = await connectorRequest<unknown>({
        instanceUrl: user.institutionUrl,
        storageState,
        apiPath: `/d2l/api/le/${version}/${orgUnitId}/content/root/`
      });

      const rootSummary = summarizeContent(contentResponse.data);
      const firstModuleId =
        typeof rootSummary["firstItemId"] === "number" ? (rootSummary["firstItemId"] as number) : null;

      let structureSummary: Record<string, unknown> | null = null;
      if (firstModuleId) {
        try {
          const structureResponse = await connectorRequest<unknown>({
            instanceUrl: user.institutionUrl,
            storageState,
            apiPath: `/d2l/api/le/${version}/${orgUnitId}/content/modules/${firstModuleId}/structure/`
          });

          structureSummary = summarizeContent(structureResponse.data);
        } catch (error) {
          // ignore structure errors since root access is still success
          if (!(error instanceof AppError)) {
            throw error;
          }
        }
      }

      // note: keep output small; don't dump full course data
      console.log(
        JSON.stringify(
          {
            ok: true,
            course: {
              orgUnitId,
              courseName: course.courseName,
              courseCode: course.courseCode
            },
            leVersion: version,
            rootSummary,
            structureSummary
          },
          null,
          2
        )
      );
      return;
    } catch (error) {
      if (error instanceof AppError && error.code === "session_expired") {
        throw new Error("session expired (reconnect and retry)");
      }

      if (error instanceof AppError && error.statusCode === 404) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("could not find a working le api version for content/root");
}

try {
  await main();
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
