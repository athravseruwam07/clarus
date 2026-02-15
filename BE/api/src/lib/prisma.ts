import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __clarusPrisma__: PrismaClient | undefined;
}

function assertPrismaClientUpToDate(client: PrismaClient): PrismaClient {
  const runtimeClient = client as unknown as Record<string, unknown>;
  const requiredDelegates = ["calendarEvent", "timelineEvent", "aiBrief", "itemState"];
  const missing = requiredDelegates.filter((delegate) => runtimeClient[delegate] === undefined);

  if (missing.length > 0) {
    throw new Error(
      `Prisma client is out of date. Missing model delegates: ${missing.join(", ")}. ` +
      "Run `npm run prisma:generate` in `BE/api` (and `npm run prisma:push` if schema changed), then restart the API."
    );
  }

  return client;
}

export const prisma = assertPrismaClientUpToDate(globalThis.__clarusPrisma__ ?? new PrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalThis.__clarusPrisma__ = prisma;
}
