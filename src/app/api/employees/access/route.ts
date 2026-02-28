import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "employees.view_all");
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  const emails = employees.map((employee) => employee.email);
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { role: true },
  });
  const userMap = new Map(users.map((user) => [user.email, user]));

  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });

  return NextResponse.json({
    employees: employees.map((employee) => {
      const user = userMap.get(employee.email);
      return {
        ...employee,
        userId: user?.id || null,
        userRole: user?.role?.name || null,
      };
    }),
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "employees.view_all");
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : null;
  const roleName = typeof body?.roleName === "string" ? body.roleName : null;

  if (!employeeId || !roleName) {
    return NextResponse.json({ error: "employeeId and roleName are required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (!employee.email) {
    return NextResponse.json({ error: "Employee email is required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { email: employee.email },
    update: {
      name: employee.name || employee.email,
      roleId: role.id,
    },
    create: {
      email: employee.email,
      name: employee.name || employee.email,
      roleId: role.id,
      passwordHash: null,
    },
  });

  return NextResponse.json({
    success: true,
    userId: user.id,
  });
}
