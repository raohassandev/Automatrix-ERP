import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { isCredentialsModeAllowed } from "@/lib/auth-credentials-guard";

const payloadSchema = z.object({
  email: z.string().trim().email(),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  if (!isCredentialsModeAllowed(process.env as Record<string, string | undefined>)) {
    return NextResponse.json(
      { success: false, error: "Credentials password operations are disabled in this environment." },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManageUsers = await requirePermission(session.user.id, "employees.view_all");
  if (!canManageUsers) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsed = payloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { status: true },
  });
  if (!employee || employee.status !== "ACTIVE") {
    return NextResponse.json({ success: false, error: "Employee is not active/allowlisted" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await logAudit({
    action: "RESET_USER_PASSWORD",
    entity: "User",
    entityId: user.id,
    newValue: JSON.stringify({ email }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
