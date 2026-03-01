import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { buildProjectAliases } from "@/lib/projects";

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
  const search = (searchParams.get("search") || "").trim();

  await logAudit({
    action: "EXPORT_PROJECTS_REPORT_CSV",
    entity: "Export",
    entityId: "projects-report",
    newValue: JSON.stringify({ route: "/api/reports/projects/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const ownProjectAssignments =
    !canViewAll && !canViewTeam && canViewOwn
      ? await prisma.projectAssignment.findMany({
          where: { userId: session.user.id },
          select: { projectId: true },
        })
      : [];
  const ownProjectIds =
    !canViewAll && !canViewTeam && canViewOwn
      ? ownProjectAssignments.map((entry) => entry.projectId)
      : [];
  const baseWhere: Record<string, unknown> =
    !canViewAll && !canViewTeam && canViewOwn
      ? ownProjectIds.length > 0
        ? { id: { in: ownProjectIds } }
        : { id: "__none__" }
      : {};

  const where = search
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { projectId: { contains: search, mode: "insensitive" as const } },
              { status: { contains: search, mode: "insensitive" as const } },
              { client: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          },
        ],
      }
    : baseWhere;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { name: "asc" },
    include: { client: true },
  });

  const projectStats = await Promise.all(
    projects.map(async (project) => {
      const projectAliases = buildProjectAliases(project);
      const [expenses, incomes, postedBills] = await Promise.all([
        prisma.expense.findMany({
          where: {
            project: { in: projectAliases },
            status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
          },
          select: { amount: true, approvedAmount: true, status: true },
        }),
        prisma.income.aggregate({
          where: { project: { in: projectAliases }, status: "APPROVED" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.vendorBill.aggregate({
          where: { projectRef: { in: projectAliases }, status: "POSTED" },
          _sum: { totalAmount: true },
          _count: true,
        }),
      ]);
      const totalExpenses = expenses.reduce((sum, exp) => {
        const used =
          exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount != null
            ? Number(exp.approvedAmount)
            : Number(exp.amount);
        return sum + (Number.isFinite(used) ? used : 0);
      }, 0);
      return {
        project,
        totalExpenses,
        expenseCount: expenses.length,
        approvedIncome: Number(incomes._sum.amount || 0),
        approvedIncomeCount: incomes._count || 0,
        postedBillsTotal: Number(postedBills._sum.totalAmount || 0),
        postedBillsCount: postedBills._count || 0,
      };
    })
  );

  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "Project",
      "Project ID",
      "Client",
      "Status",
      "Expense Count",
      "Total Expenses (approved)",
      "Approved Income",
      "Posted AP Bills",
      "Contract Value",
      "Cost To Date",
      "Gross Margin",
      "Pending Recovery",
      "Cost %",
    ],
    ...projectStats.map(
      ({
        project,
        totalExpenses,
        expenseCount,
        approvedIncome,
        postedBillsTotal,
      }) => {
      const contractValue = Number(project.contractValue);
      const percentUsed = contractValue > 0 ? (Number(project.costToDate) / contractValue) * 100 : 0;
      return [
        project.name,
        project.projectId,
        project.client?.name || "",
        project.status,
        expenseCount,
        formatMoney(totalExpenses),
        formatMoney(approvedIncome),
        formatMoney(postedBillsTotal),
        formatMoney(contractValue),
        formatMoney(Number(project.costToDate)),
        formatMoney(Number(project.grossMargin)),
        formatMoney(Number(project.pendingRecovery)),
        `${percentUsed.toFixed(1)}%`,
      ];
      },
    ),
  ];

  const csv = toCsv(rows);
  const filename = `project_expenses_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
