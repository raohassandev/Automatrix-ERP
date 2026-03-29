import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { normalizeExpenseAmount } from "@/lib/employee-finance";
import { decodeHtmlEntities } from "@/lib/sanitize";

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

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
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
  const search = (searchParams.get("search") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const submittedById = (searchParams.get("submittedById") || "").trim();
  const category = (searchParams.get("category") || "").trim();
  const paymentSource = (searchParams.get("paymentSource") || "").trim();
  const project = (searchParams.get("project") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const mode = (searchParams.get("mode") || "detail").trim().toLowerCase();

  await logAudit({
    action: "EXPORT_EMPLOYEE_EXPENSES_REPORT_CSV",
    entity: "Export",
    entityId: "employee-expenses-report",
    newValue: JSON.stringify({ route: "/api/reports/employee-expenses/export", query: searchParams.toString(), mode }),
    userId: session.user.id,
  });

  const where: import("@prisma/client").Prisma.ExpenseWhereInput = {
    status: status ? status : { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
  };
  if (!canViewAll && !canViewTeam) {
    where.submittedById = session.user.id;
  } else if (submittedById) {
    where.submittedById = submittedById;
  }
  if (category) where.category = category;
  if (paymentSource) where.paymentSource = paymentSource;
  if (project) where.project = project;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { project: { contains: search, mode: "insensitive" } },
      { paymentSource: { contains: search, mode: "insensitive" } },
      { submittedBy: { name: { contains: search, mode: "insensitive" } } },
      { submittedBy: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      id: true,
      date: true,
      amount: true,
      approvedAmount: true,
      status: true,
      project: true,
      description: true,
      category: true,
      paymentSource: true,
      submittedById: true,
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  if (mode === "summary" || mode === "projects") {
    const employeeSummaryMap = new Map<string, { name: string; email: string; claims: number; total: number }>();
    const categorySummaryMap = new Map<string, { claims: number; total: number }>();
    const monthSummaryMap = new Map<string, { claims: number; total: number }>();
    const projectSummaryMap = new Map<string, { claims: number; total: number; pocket: number; wallet: number; company: number }>();
    const sourceSummaryMap = new Map<string, { claims: number; total: number }>();

    expenses.forEach((row) => {
      const approvedAmount = Number(normalizeExpenseAmount(row));
      const employeeKey = row.submittedById || "unknown";
      const employeeEntry = employeeSummaryMap.get(employeeKey) || {
        name: row.submittedBy?.name ? decodeHtmlEntities(row.submittedBy.name) : "Unknown",
        email: row.submittedBy?.email || "unknown",
        claims: 0,
        total: 0,
      };
      employeeEntry.claims += 1;
      employeeEntry.total += approvedAmount;
      employeeSummaryMap.set(employeeKey, employeeEntry);

      const categoryLabel = decodeHtmlEntities(row.category);
      const categoryEntry = categorySummaryMap.get(categoryLabel) || { claims: 0, total: 0 };
      categoryEntry.claims += 1;
      categoryEntry.total += approvedAmount;
      categorySummaryMap.set(categoryLabel, categoryEntry);

      const month = monthLabel(new Date(row.date));
      const monthEntry = monthSummaryMap.get(month) || { claims: 0, total: 0 };
      monthEntry.claims += 1;
      monthEntry.total += approvedAmount;
      monthSummaryMap.set(month, monthEntry);

      const projectKey = row.project ? decodeHtmlEntities(row.project) : "Unassigned";
      const projectEntry = projectSummaryMap.get(projectKey) || { claims: 0, total: 0, pocket: 0, wallet: 0, company: 0 };
      projectEntry.claims += 1;
      projectEntry.total += approvedAmount;
      if (row.paymentSource === "EMPLOYEE_POCKET") projectEntry.pocket += approvedAmount;
      else if (row.paymentSource === "EMPLOYEE_WALLET") projectEntry.wallet += approvedAmount;
      else projectEntry.company += approvedAmount;
      projectSummaryMap.set(projectKey, projectEntry);

      const sourceKey = row.paymentSource ? decodeHtmlEntities(row.paymentSource) : "UNSPECIFIED";
      const sourceEntry = sourceSummaryMap.get(sourceKey) || { claims: 0, total: 0 };
      sourceEntry.claims += 1;
      sourceEntry.total += approvedAmount;
      sourceSummaryMap.set(sourceKey, sourceEntry);
    });

    if (mode === "projects") {
      const rows: Array<Array<string | number | null | undefined>> = [
        ["Section", "Label", "Claims", "Total", "Average", "Pocket", "Wallet", "Company"],
        ...Array.from(projectSummaryMap.entries()).map(([label, row]) => [
          "Project",
          label,
          row.claims,
          row.total,
          row.claims > 0 ? row.total / row.claims : 0,
          row.pocket,
          row.wallet,
          row.company,
        ]),
        ...Array.from(sourceSummaryMap.entries()).map(([label, row]) => [
          "Payment Source",
          label,
          row.claims,
          row.total,
          row.claims > 0 ? row.total / row.claims : 0,
          null,
          null,
          null,
        ]),
      ];

      return new Response(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=employee_expense_projects_${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    const rows: Array<Array<string | number | null | undefined>> = [
      ["Section", "Label", "Metric 1", "Metric 2", "Metric 3"],
      ...Array.from(employeeSummaryMap.values()).map((row) => ["Employee", row.name, row.email, row.claims, row.total]),
      ...Array.from(categorySummaryMap.entries()).map(([label, row]) => ["Category", label, row.claims, row.total, row.claims > 0 ? row.total / row.claims : 0]),
      ...Array.from(monthSummaryMap.entries()).map(([label, row]) => ["Month", label, row.claims, row.total, row.claims > 0 ? row.total / row.claims : 0]),
      ...Array.from(projectSummaryMap.entries()).map(([label, row]) => ["Project", label, row.claims, row.total, row.claims > 0 ? row.total / row.claims : 0]),
      ...Array.from(sourceSummaryMap.entries()).map(([label, row]) => ["Payment Source", label, row.claims, row.total, row.claims > 0 ? row.total / row.claims : 0]),
    ];

    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=employee_expense_summary_${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  }

  const rows: Array<Array<string | number | null | undefined>> = [
    ["Date", "Employee", "Email", "Category", "Project", "Payment Source", "Status", "Amount", "Approved Amount", "Description", "Expense Id"],
    ...expenses.map((row) => [
      row.date.toISOString(),
      row.submittedBy?.name ? decodeHtmlEntities(row.submittedBy.name) : "Unknown",
      row.submittedBy?.email || "unknown",
      decodeHtmlEntities(row.category),
      row.project ? decodeHtmlEntities(row.project) : "",
      row.paymentSource ? decodeHtmlEntities(row.paymentSource) : "",
      row.status,
      Number(row.amount),
      Number(normalizeExpenseAmount(row)),
      decodeHtmlEntities(row.description),
      row.id,
    ]),
  ];

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=employee_expense_detail_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
