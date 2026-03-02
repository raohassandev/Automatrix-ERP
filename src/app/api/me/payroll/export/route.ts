import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canViewAll = await requirePermission(session.user.id, "employees.view_all");
  if (!canViewOwn && !canViewAll) {
    return new Response("Forbidden", { status: 403 });
  }

  const employee = await prisma.employee.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!employee) {
    return new Response("Employee not found", { status: 404 });
  }

  await logAudit({
    action: "EXPORT_MY_PAYROLL_CSV",
    entity: "Export",
    entityId: `my-payroll:${employee.id}`,
    newValue: JSON.stringify({ route: "/api/me/payroll/export" }),
    userId: session.user.id,
  });

  const rows = await prisma.payrollEntry.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: "desc" },
    include: { payrollRun: true, components: true },
  });

  const csvRows: Array<Array<string | number | null | undefined>> = [
    ["Period Start", "Period End", "Base Salary", "Incentives", "Deductions", "Net Pay", "Status", "Components"],
    ...rows.map((row) => [
      row.payrollRun?.periodStart.toISOString().slice(0, 10) || "",
      row.payrollRun?.periodEnd.toISOString().slice(0, 10) || "",
      formatMoney(Number(row.baseSalary)),
      formatMoney(Number(row.incentiveTotal)),
      formatMoney(Number(row.deductions)),
      formatMoney(Number(row.netPay)),
      row.status,
      row.components
        .map(
          (line) =>
            `${line.componentType}:${line.description}${line.projectRef ? ` [${line.projectRef}]` : ""} ${formatMoney(Number(line.amount))}`,
        )
        .join(" | "),
    ]),
  ];

  const csv = toCsv(csvRows);
  const filename = `my_salary_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
