import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
}

function ageDays(date: Date) {
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "salary_advance.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canEdit = await requirePermission(session.user.id, "salary_advance.edit");
  if (!canViewAll && !canViewOwn && !canEdit) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const employeeId = (searchParams.get("employeeId") || "").trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let ownEmployeeId: string | null = null;
  if (!canViewAll && session.user.email) {
    const employee = await findEmployeeByEmailInsensitive(session.user.email, { select: { id: true } });
    ownEmployeeId = employee?.id || null;
  }

  const where: import("@prisma/client").Prisma.SalaryAdvanceWhereInput = {};
  if (!canViewAll) {
    where.employeeId = ownEmployeeId || "__none__";
  } else if (employeeId) {
    where.employeeId = employeeId;
  }
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { employee: { name: { contains: search, mode: "insensitive" } } },
      { employee: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  await logAudit({
    action: "EXPORT_SALARY_ADVANCES_CSV",
    entity: "Export",
    entityId: employeeId || ownEmployeeId || "salary-advances",
    newValue: JSON.stringify({ route: "/api/salary-advances/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const rows = await prisma.salaryAdvance.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: { employee: true },
  });

  const csv = toCsv([
    ["Date", "Employee", "Email", "Amount", "Outstanding", "Age Days", "Recovery Mode", "Status", "Reason", "Advance Id"],
    ...rows.map((row) => [
      row.createdAt.toISOString(),
      row.employee?.name || "",
      row.employee?.email || "",
      Number(row.amount),
      Number(row.outstandingAmount || 0),
      ageDays(new Date(row.createdAt)),
      row.recoveryMode,
      row.status,
      row.reason,
      row.id,
    ]),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=salary_advances_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
