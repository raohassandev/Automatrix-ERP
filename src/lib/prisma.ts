import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  // This repo uses Prisma with PostgreSQL (see prisma/schema.prisma).
  // A common failure mode is leaving the old SQLite URL in DATABASE_URL.
  if (url.startsWith("file:")) {
    throw new Error(
      [
        "Invalid DATABASE_URL for current configuration.",
        "This app is configured for PostgreSQL (provider=\"postgresql\").",
        "Set DATABASE_URL to something like: postgresql://user:pass@localhost:5432/db?schema=public",
      ].join(" ")
    );
  }

  if (!/^postgres(ql)?:/i.test(url)) {
    throw new Error(
      [
        "Invalid DATABASE_URL format for PostgreSQL.",
        "Expected DATABASE_URL to start with 'postgresql://'.",
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
