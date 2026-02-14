import type { D2LEnrollmentItem, D2LEnrollmentsResponse } from "./types.js";

export const WHOAMI_API_PATH = "/d2l/api/lp/1.28/users/whoami";
export const MY_ENROLLMENTS_API_PATH =
  "/d2l/api/lp/1.28/enrollments/myenrollments/?sortBy=-StartDate";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readIdentifier(value: unknown): string | undefined {
  if (typeof value === "number") {
    return value.toString();
  }

  return readString(value);
}

export function normalizeInstanceUrl(instanceUrl: string): string {
  const trimmed = instanceUrl.trim();
  if (!trimmed.startsWith("https://")) {
    throw new Error("instanceUrl must start with https://");
  }

  const parsed = new URL(trimmed);
  parsed.hash = "";
  parsed.search = "";

  return parsed.toString().replace(/\/$/, "");
}

export function parseWhoami(whoami: Record<string, unknown>): {
  brightspaceUserId?: string;
  brightspaceUsername?: string;
  name?: string;
} {
  const firstName = readString(whoami["FirstName"]);
  const lastName = readString(whoami["LastName"]);
  const displayName = readString(whoami["DisplayName"]);
  const fallbackName =
    [firstName, lastName]
      .filter((value): value is string => typeof value === "string")
      .join(" ") || undefined;

  return {
    brightspaceUserId:
      readIdentifier(whoami["Identifier"]) ?? readIdentifier(whoami["UserId"]),
    brightspaceUsername:
      readString(whoami["UniqueName"]) ?? readString(whoami["UserName"]),
    name: displayName ?? fallbackName
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asAccess(value: unknown): { StartDate?: string | null; EndDate?: string | null; IsActive?: boolean } | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return {
    StartDate: typeof record["StartDate"] === "string" ? (record["StartDate"] as string) : null,
    EndDate: typeof record["EndDate"] === "string" ? (record["EndDate"] as string) : null,
    IsActive: typeof record["IsActive"] === "boolean" ? (record["IsActive"] as boolean) : undefined
  };
}

function toEnrollmentItem(value: unknown): D2LEnrollmentItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const orgUnit = asRecord(record["OrgUnit"]);
  if (!orgUnit) {
    return null;
  }

  const id = orgUnit["Id"];
  const name = orgUnit["Name"];

  if (!(typeof id === "number" || typeof id === "string") || typeof name !== "string") {
    return null;
  }

  return {
    ...record,
    OrgUnit: {
      Id: id,
      Name: name,
      Code: typeof orgUnit["Code"] === "string" ? (orgUnit["Code"] as string) : null
    },
    Access: asAccess(record["Access"])
  };
}

export function extractEnrollmentItems(data: unknown): D2LEnrollmentItem[] {
  const response = asRecord(data) as D2LEnrollmentsResponse | null;
  const items = response?.Items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => toEnrollmentItem(item))
    .filter((item): item is D2LEnrollmentItem => item !== null);
}

export function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
