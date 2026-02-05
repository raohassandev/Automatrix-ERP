import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

const registerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canManage =
      (await requirePermission(session.user.id, "employees.view_all")) &&
      (await requirePermission(session.user.id, "employees.edit_wallet"));
    if (!canManage) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminEmail = process.env.ADMIN_EMAIL;
    const roleName = adminEmail && adminEmail.toLowerCase() === email.toLowerCase() ? "Owner" : "Staff";
    const role = await prisma.role.findUnique({ where: { name: roleName } });

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        passwordHash,
        roleId: role?.id || null,
      },
    });

    await prisma.employee.upsert({
      where: { email },
      update: { name: user.name || email.split("@")[0], role: roleName },
      create: {
        email,
        name: user.name || email.split("@")[0],
        role: roleName,
      },
    });

    return NextResponse.json({ success: true, data: { id: user.id, email: user.email } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
