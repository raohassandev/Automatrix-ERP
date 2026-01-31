import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const data = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Sanitize string inputs after validation
  const sanitizedData = {
    ...parsed.data,
    userId: parsed.data.userId ? sanitizeString(parsed.data.userId) : undefined,
    type: sanitizeString(parsed.data.type),
    message: sanitizeString(parsed.data.message),
    status: parsed.data.status ? sanitizeString(parsed.data.status) : "NEW",
  };

  const created = await prisma.notification.create({
    data: {
      userId: sanitizedData.userId || session.user.id,
      type: sanitizedData.type,
      message: sanitizedData.message,
      status: sanitizedData.status,
    },
  });

  await logAudit({
    action: "CREATE_NOTIFICATION",
    entity: "Notification",
    entityId: created.id,
    newValue: JSON.stringify(sanitizedData),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
