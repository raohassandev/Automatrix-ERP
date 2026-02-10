import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public health check used by uptime monitors.
// Keep it fast and dependency-light (no auth, no RBAC).
export async function GET() {
  try {
    // Basic DB connectivity check.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

