import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __clarusPrisma__: PrismaClient | undefined;
}

export const prisma = globalThis.__clarusPrisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__clarusPrisma__ = prisma;
}
