import type { FastifyRequest } from "fastify";

function readHeader(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first && first.length > 0 ? first : null;
  }
  return null;
}

export function readClientPrefs(request: FastifyRequest): { timeZone: string | null; locale: string | null } {
  return {
    timeZone: readHeader(request, "x-client-timezone"),
    locale: readHeader(request, "x-client-locale")
  };
}

export function formatIsoInClientPrefs(
  iso: string | null | undefined,
  prefs: { timeZone: string | null; locale: string | null }
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const locale = prefs.locale ?? "en-US";

  // If timezone is invalid/unsupported, fall back to runtime local time.
  if (prefs.timeZone) {
    try {
      return new Intl.DateTimeFormat(locale, {
        timeZone: prefs.timeZone,
        dateStyle: "full",
        timeStyle: "short"
      }).format(date);
    } catch {
      // ignore and fall through
    }
  }

  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

