import crypto from "node:crypto";

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const FEED_TOKEN_PREFIX = "calendar-feed";
const FEED_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;
const FEED_WINDOW_PAST_DAYS = 30;
const FEED_WINDOW_FUTURE_DAYS = 365;
const FEED_METHODS = ["GET", "HEAD"];

function createFeedSignature(userId: string, expiresAtMs: number): string {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`${FEED_TOKEN_PREFIX}:${userId}.${expiresAtMs}`)
    .digest("hex");
}

function createLegacyFeedSignature(userId: string, expiresAtMs: number): string {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`${FEED_TOKEN_PREFIX}:${userId}.${expiresAtMs}`)
    .digest("base64url");
}

function createFeedToken(userId: string, expiresAtMs: number): string {
  const signature = createFeedSignature(userId, expiresAtMs);
  return `${userId}_${expiresAtMs}_${signature}`;
}

function timingSafeMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function decodeFeedToken(token: string): { userId: string; expiresAtMs: number; signature: string; isLegacy: boolean } | null {
  let userId = "";
  let expiresAtRaw = "";
  let signature = "";
  let isLegacy = false;

  const modernParts = token.split("_");
  if (modernParts.length === 3) {
    [userId, expiresAtRaw, signature] = modernParts;
  } else {
    const legacyParts = token.split(".");
    if (legacyParts.length !== 3) {
      return null;
    }
    [userId, expiresAtRaw, signature] = legacyParts;
    isLegacy = true;
  }

  if (!userId || !expiresAtRaw || !signature) {
    return null;
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  return { userId, expiresAtMs, signature, isLegacy };
}

function verifyFeedToken(token: string): { userId: string } | null {
  const compact = token.trim().replace(/\s+/g, "");
  if (!compact) {
    return null;
  }

  const candidates = [compact];
  // Some webcal clients may inject line-break hyphens in long path segments.
  if (!compact.includes(".") && compact.includes("-")) {
    candidates.push(compact.replace(/-/g, ""));
  }

  for (const candidate of candidates) {
    const decoded = decodeFeedToken(candidate);
    if (!decoded) {
      continue;
    }

    const expected = decoded.isLegacy
      ? createLegacyFeedSignature(decoded.userId, decoded.expiresAtMs)
      : createFeedSignature(decoded.userId, decoded.expiresAtMs);
    if (!timingSafeMatch(decoded.signature, expected)) {
      continue;
    }

    return { userId: decoded.userId };
  }

  return null;
}

function requestOrigin(request: FastifyRequest): string {
  const protoHeader = request.headers["x-forwarded-proto"];
  const hostHeader = request.headers["x-forwarded-host"] ?? request.headers.host;

  const protocol =
    typeof protoHeader === "string" && protoHeader.trim().length > 0
      ? protoHeader.split(",")[0]?.trim()
      : "http";
  const safeProtocol = protocol === "https" ? "https" : "http";

  const host =
    typeof hostHeader === "string" && hostHeader.trim().length > 0
      ? hostHeader.split(",")[0]?.trim()
      : `localhost:${env.PORT}`;
  // Apple Calendar subscriptions are more reliable against an explicit IPv4 loopback host.
  const normalizedHost = host
    .replace(/^\[::1\](?::(\d+))?$/i, (_match, port: string | undefined) =>
      port ? `127.0.0.1:${port}` : "127.0.0.1"
    )
    .replace(/^localhost(?::(\d+))?$/i, (_match, port: string | undefined) =>
      port ? `127.0.0.1:${port}` : "127.0.0.1"
    );
  return `${safeProtocol}://${normalizedHost}`;
}

function toUtcDateText(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

function toUtcDateTimeText(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeIcsText(value: string): string {
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

  return cleaned
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(value: string): string {
  if (value.length <= 74) {
    return value;
  }

  let cursor = 0;
  let output = "";
  while (cursor < value.length) {
    const width = cursor === 0 ? 74 : 73;
    const chunk = value.slice(cursor, cursor + width);
    output += cursor === 0 ? chunk : `\r\n ${chunk}`;
    cursor += width;
  }

  return output;
}

function sourceLabel(sourceType: string): string {
  return sourceType
    .split("_")
    .map((part) => (part.length > 0 ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : part))
    .join(" ");
}

function kindPrefix(dateKind: string): string {
  switch (dateKind) {
    case "due":
      return "Due";
    case "start":
      return "Start";
    case "end":
      return "End";
    default:
      return "Event";
  }
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 0, 0, 0));
}

function renderCalendarFeed(input: {
  calendarName: string;
  generatedAt: Date;
  events: Array<{
    sourceType: string;
    sourceId: string;
    dateKind: string;
    brightspaceOrgUnitId: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date | null;
    isAllDay: boolean;
    viewUrl: string | null;
    courseName: string | null;
    courseCode: string | null;
  }>;
}): string {
  const dtStamp = toUtcDateTimeText(input.generatedAt);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clarus//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(input.calendarName)}`),
    `X-PUBLISHED-TTL:PT15M`
  ];

  for (const event of input.events) {
    const uid = `clarus-${event.brightspaceOrgUnitId}-${event.sourceType}-${event.sourceId}-${event.dateKind}@clarus.app`;
    const summary =
      event.dateKind === "event" ? event.title : `${kindPrefix(event.dateKind)}: ${event.title}`;

    const details: string[] = [];
    const courseLabel = event.courseCode
      ? `${event.courseCode}${event.courseName ? ` · ${event.courseName}` : ""}`
      : event.courseName;

    if (courseLabel) {
      details.push(`Course: ${courseLabel}`);
    }

    details.push(`Source: ${sourceLabel(event.sourceType)}`);

    if (event.description) {
      details.push("", event.description);
    }

    if (event.viewUrl) {
      details.push("", `Open in Brightspace: ${event.viewUrl}`);
    }

    lines.push("BEGIN:VEVENT");
    lines.push(foldIcsLine(`UID:${escapeIcsText(uid)}`));
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`));

    if (details.length > 0) {
      lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(details.join("\n"))}`));
    }

    if (event.isAllDay) {
      const startDate = toUtcDateText(event.startAt);
      const endExclusive = toUtcDateText(
        event.endAt ? addDaysUtc(event.endAt, 1) : addDaysUtc(event.startAt, 1)
      );

      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      lines.push(`DTEND;VALUE=DATE:${endExclusive}`);
    } else {
      const endAt = event.endAt ?? new Date(event.startAt.getTime() + 60 * 60 * 1000);
      lines.push(`DTSTART:${toUtcDateTimeText(event.startAt)}`);
      lines.push(`DTEND:${toUtcDateTimeText(endAt)}`);
    }

    if (event.viewUrl) {
      lines.push(foldIcsLine(`URL:${event.viewUrl}`));
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

const calendarIntegrationsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/calendar/integrations/feed",
    { preHandler: fastify.requireAuth },
    async (request) => {
      if (!request.auth) {
        throw new AppError(401, "authentication required", "unauthorized");
      }

      const expiresAtMs = Date.now() + FEED_TOKEN_TTL_MS;
      const token = createFeedToken(request.auth.user.id, expiresAtMs);
      const origin = requestOrigin(request);
      const feedUrl = `${origin}/v1/calendar/integrations/feed.ics?token=${encodeURIComponent(token)}`;
      const webcalUrl = `${origin}/v1/calendar/integrations/feed.ics?token=${encodeURIComponent(token)}`
        .replace(/^https?:\/\//, "webcal://");

      return {
        feedUrl,
        webcalUrl,
        expiresAt: new Date(expiresAtMs).toISOString()
      };
    }
  );

  async function handleFeedRequest(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { token?: string };
    const params = request.params as { token?: string; "*"?: string };
    const tokenFromParams = typeof params?.token === "string" ? params.token : "";
    const tokenFromWildcard =
      typeof params?.["*"] === "string"
        ? decodeURIComponent(params["*"]).split("/")[0]?.trim() ?? ""
        : "";
    const tokenFromQuery = typeof query.token === "string" ? query.token : "";
    let tokenFromPath = "";
    try {
      tokenFromPath =
        decodeURIComponent(request.url)
          .match(/\/calendar\/integrations\/feed\/([^/?]+)(?:\/calendar\.ics|\.ics|\/)?(?:\?|$)/)?.[1]
          ?.trim() ?? "";
    } catch {
      tokenFromPath = "";
    }
    const token = tokenFromParams || tokenFromWildcard || tokenFromQuery || tokenFromPath || "";
    const parsed = verifyFeedToken(token);

    if (!parsed) {
      throw new AppError(401, "invalid or expired feed token", "invalid_feed_token");
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, name: true }
    });

    if (!user) {
      throw new AppError(404, "feed owner not found", "feed_user_not_found");
    }

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - FEED_WINDOW_PAST_DAYS);
    const to = new Date(now);
    to.setDate(to.getDate() + FEED_WINDOW_FUTURE_DAYS);

    const events = await prisma.timelineEvent.findMany({
      where: {
        userId: user.id,
        dateKind: { in: ["event", "start", "due", "end"] },
        startAt: {
          gte: from,
          lte: to
        }
      },
      include: {
        course: {
          select: {
            courseName: true,
            courseCode: true
          }
        }
      },
      orderBy: [{ startAt: "asc" }, { sourceType: "asc" }, { sourceId: "asc" }]
    });

    reply.header("content-type", "text/calendar; charset=utf-8");
    reply.header("cache-control", "private, max-age=300, must-revalidate");
    reply.header("content-disposition", 'inline; filename="clarus-calendar.ics"');

    if (request.method === "HEAD") {
      return reply.code(200).send();
    }

    const calendarName = `Clarus Academic Timeline${user.name ? ` · ${user.name}` : ""}`;
    const body = renderCalendarFeed({
      calendarName,
      generatedAt: now,
      events: events.map((event) => ({
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        dateKind: event.dateKind,
        brightspaceOrgUnitId: event.brightspaceOrgUnitId,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        isAllDay: event.isAllDay,
        viewUrl: event.viewUrl,
        courseName: event.course?.courseName ?? null,
        courseCode: event.course?.courseCode ?? null
      }))
    });

    return reply.send(body);
  }

  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed/:token/calendar.ics",
    handler: handleFeedRequest
  });

  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed/:token/calendar.ics/",
    handler: handleFeedRequest
  });

  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed/:token.ics",
    handler: handleFeedRequest
  });

  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed/:token",
    handler: handleFeedRequest
  });

  // Backward compatible path for early-generated links.
  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed.ics",
    handler: handleFeedRequest
  });

  // Some calendar clients normalize `.ics` endpoints with a trailing slash.
  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed.ics/",
    handler: handleFeedRequest
  });

  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed.ics/*",
    handler: handleFeedRequest
  });

  // Wildcard fallback so webcal clients that alter URL shape still resolve.
  fastify.route({
    method: FEED_METHODS,
    url: "/calendar/integrations/feed/*",
    handler: handleFeedRequest
  });
};

export default calendarIntegrationsRoute;
