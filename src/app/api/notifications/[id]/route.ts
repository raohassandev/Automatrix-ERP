import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.message) data.message = body.message;
  if (body.type) data.type = body.type;

  const updated = await prisma.notification.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_NOTIFICATION",
    entity: "Notification",
    entityId: id,
    newValue: JSON.stringify(body),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  await prisma.notification.delete({ where: { id } });

  await logAudit({
    action: "DELETE_NOTIFICATION",
    entity: "Notification",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
