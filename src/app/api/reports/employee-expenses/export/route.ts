import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

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

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canExport = await requirePermission(session.user.id, "reports.export");
  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canExport || (!canViewAll && !canViewTeam && !canViewOwn)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await logAudit({
    action: "EXPORT_EMPLOYEE_EXPENSES_REPORT_CSV",
    entity: "Export",
    entityId: "employee-expenses-report",
    newValue: JSON.stringify({ route: "/api/reports/employee-expenses/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const where: Record<string, unknown> = {
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
  };
  if (!canViewAll && !canViewTeam) {
    where.submittedById = session.user.id;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      submittedById: true,
      amount: true,
      approvedAmount: true,
      status: true,
      project: true,
      description: true,
      category: true,
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: { date: "desc" },
  });

  const filtered = search
    ? expenses.filter((exp) => {
        const haystack = [
          exp.submittedBy?.name,
          exp.submittedBy?.email,
          exp.project,
          exp.description,
          exp.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
    : expenses;

  const aggregated = new Map<
    string,
    { name: string; email: string; total: number; count: number }
  >();

  filtered.forEach((exp) => {
    const key = exp.submittedById || "unknown";
    const usedAmount =
      exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount !== null
        ? Number(exp.approvedAmount)
        : Number(exp.amount);
    const entry = aggregated.get(key) || {
      name: exp.submittedBy?.name || "Unknown",
      email: exp.submittedBy?.email || "unknown",
      total: 0,
      count: 0,
    };
    entry.total += usedAmount;
    entry.count += 1;
    aggregated.set(key, entry);
  });

  const rows = Array.from(aggregated.values()).sort((a, b) => b.total - a.total);

  const csvRows: Array<Array<string | number | null | undefined>> = [
    ["Employee", "Email", "Records", "Total Approved"],
    ...rows.map((row) => [row.name, row.email, row.count, row.total]),
  ];

  const csv = toCsv(csvRows);
  const filename = `employee_expenses_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
