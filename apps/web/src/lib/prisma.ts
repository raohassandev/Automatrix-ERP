import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  // This repo currently uses Prisma with SQLite (see prisma/schema.prisma).
  // A common failure mode is copying a Postgres URL into DATABASE_URL, which causes
  // confusing runtime errors (often SQLite error code 14 / "unable to open database file").
  if (/^postgres(ql)?:/i.test(url) || url.includes("postgresql://")) {
    throw new Error(
      [
        "Invalid DATABASE_URL for current configuration.",
        "This app is currently configured for SQLite (provider=\"sqlite\").",
        "Set DATABASE_URL to something like: file:./dev.db",
      ].join(" ")
    );
  }

  // SQLite URLs should be file-based.
  if (!url.startsWith("file:")) {
    throw new Error(
      [
        "Invalid DATABASE_URL format for SQLite.",
        "Expected DATABASE_URL to start with 'file:' (example: file:./dev.db).",
      ].join(" ")
    );
  }
}

validateDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
