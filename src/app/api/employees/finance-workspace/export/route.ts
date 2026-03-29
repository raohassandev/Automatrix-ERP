import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";
import { getEmployeeFinanceWorkspaceData } from "@/lib/employee-finance";

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

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [canViewAll, canViewTeam, canViewOwn, canReportsAll, canReportsTeam, canReportsOwn, canExport] = await Promise.all([
    requirePermission(session.user.id, "employees.view_all"),
    requirePermission(session.user.id, "employees.view_team"),
    requirePermission(session.user.id, "employees.view_own"),
    requirePermission(session.user.id, "reports.view_all"),
    requirePermission(session.user.id, "reports.view_team"),
    requirePermission(session.user.id, "reports.view_own"),
    requirePermission(session.user.id, "reports.export"),
  ]);

  if (!canExport || (!canViewAll && !canViewTeam && !canViewOwn) || (!canReportsAll && !canReportsTeam && !canReportsOwn)) {
    return new Response("Forbidden", { status: 403 });
  }

  const currentEmployee = session.user.email
    ? await findEmployeeByEmailInsensitive(session.user.email, {
        select: { id: true, directReports: { select: { id: true } } },
      })
    : null;

  const scopedEmployeeIds = canViewAll
    ? null
    : canViewTeam
      ? [currentEmployee?.id, ...(currentEmployee?.directReports.map((row) => row.id) || [])].filter(Boolean)
      : currentEmployee?.id
        ? [currentEmployee.id]
        : [];

  const employeeOptions = await prisma.employee.findMany({
    where: scopedEmployeeIds ? { id: { in: scopedEmployeeIds as string[] } } : {},
    select: { id: true },
    orderBy: { name: "asc" },
  });

  if (employeeOptions.length === 0) {
    return new Response("No accessible employee records", { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const selectedEmployeeId = employeeOptions.some((row) => row.id === (searchParams.get("employeeId") || "").trim())
    ? (searchParams.get("employeeId") || "").trim()
    : employeeOptions[0].id;

  const workspace = await getEmployeeFinanceWorkspaceData({
    employeeId: selectedEmployeeId,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    search: searchParams.get("search") || undefined,
    event: searchParams.get("event") || undefined,
    category: searchParams.get("category") || undefined,
    paymentSource: searchParams.get("paymentSource") || undefined,
    project: searchParams.get("project") || undefined,
  });

  if (!workspace) {
    return new Response("Employee not found", { status: 404 });
  }

  await logAudit({
    action: "EXPORT_EMPLOYEE_FINANCE_WORKSPACE_CSV",
    entity: "Export",
    entityId: `employee-finance:${selectedEmployeeId}`,
    newValue: JSON.stringify({ route: "/api/employees/finance-workspace/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const rows: Array<Array<string | number | null | undefined>> = [
    ["Employee", workspace.employee.name],
    ["Email", workspace.employee.email],
    ["Range From", workspace.rangeFrom.toISOString()],
    ["Range To", workspace.rangeTo.toISOString()],
    [],
    ["Date", "Module", "Reference", "Status", "Impact", "Amount", "Running Balance", "Category", "Payment Source", "Project", "Source Type", "Note", "Href"],
    ...workspace.timeline.map((row) => [
      row.date.toISOString(),
      row.module,
      row.reference,
      row.status,
      row.impact,
      row.amount,
      row.runningBalance,
      row.category,
      row.paymentSource,
      row.project,
      row.sourceType,
      row.note,
      row.href,
    ]),
  ];

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=employee_finance_${selectedEmployeeId}_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
