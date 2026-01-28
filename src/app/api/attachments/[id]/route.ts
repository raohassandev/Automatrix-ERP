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
  if (body.fileName) data.fileName = body.fileName;
  if (body.fileUrl) data.fileUrl = body.fileUrl;
  if (body.type) data.type = body.type;

  const updated = await prisma.attachment.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_ATTACHMENT",
    entity: "Attachment",
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
  await prisma.attachment.delete({ where: { id } });

  await logAudit({
    action: "DELETE_ATTACHMENT",
    entity: "Attachment",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
