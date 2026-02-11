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

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params; // item id
  const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
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
  await logAudit({
    action: "ITEM_NOTE_ADD",
    entity: "InventoryItem",
    entityId: id,
    newValue: JSON.stringify({ note }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}

