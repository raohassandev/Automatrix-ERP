import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { z } from "zod";

const noteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

async function requireProjectAccess(userId: string, projectDbId: string) {
  const canViewAll = await requirePermission(userId, "projects.view_all");
  const canViewAssigned = await requirePermission(userId, "projects.view_assigned");
  if (!canViewAll && !canViewAssigned) return { ok: false as const, status: 403 as const };

  const project = await prisma.project.findUnique({ where: { id: projectDbId }, select: { id: true } });
  if (!project) return { ok: false as const, status: 404 as const };

  if (!canViewAll) {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId: projectDbId, userId },
      select: { id: true },
    });
    if (!assigned) return { ok: false as const, status: 403 as const };
  }

  return { ok: true as const };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const access = await requireProjectAccess(session.user.id, id);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.status === 404 ? "Not found" : "Forbidden" }, { status: access.status });
  }

  const body = await req.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const note = sanitizeString(parsed.data.note);

  // Phase 1: notes are stored as audited events (no new Note model in Phase 1).
  await logAudit({
    action: "PROJECT_NOTE_ADD",
    entity: "Project",
    entityId: id,
    newValue: JSON.stringify({ note }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}

