import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";

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

  const ownProjectRefs =
    !canViewAll && !canViewTeam && canViewOwn
      ? await prisma.expense.findMany({
          where: { submittedById: session.user.id, project: { not: null } },
          select: { project: true },
        })
      : [];
  const ownProjectValues =
    !canViewAll && !canViewTeam && canViewOwn
      ? Array.from(new Set(ownProjectRefs.map((entry) => entry.project).filter(Boolean))) as string[]
      : [];
  const baseWhere: Record<string, unknown> =
    !canViewAll && !canViewTeam && canViewOwn
      ? ownProjectValues.length > 0
        ? { OR: [{ projectId: { in: ownProjectValues } }, { name: { in: ownProjectValues } }] }
        : { id: "__none__" }
      : {};

  const where = search
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { projectId: { contains: search, mode: "insensitive" } },
              { status: { contains: search, mode: "insensitive" } },
              { client: { name: { contains: search, mode: "insensitive" } } },
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

  const projectExpenses = await Promise.all(
    projects.map(async (project) => {
      const expenses = await prisma.expense.aggregate({
        where: { project: { in: [project.projectId, project.name] } },
        _sum: { amount: true },
        _count: true,
      });
      return {
        project,
        totalExpenses: Number(expenses._sum.amount || 0),
        expenseCount: expenses._count || 0,
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
      "Total Expenses",
      "Contract Value",
      "Cost %",
    ],
    ...projectExpenses.map(({ project, totalExpenses, expenseCount }) => {
      const contractValue = Number(project.contractValue);
      const percentUsed = contractValue > 0 ? (Number(project.costToDate) / contractValue) * 100 : 0;
      return [
        project.name,
        project.projectId,
        project.client?.name || "",
        project.status,
        expenseCount,
        formatMoney(totalExpenses),
        formatMoney(contractValue),
        `${percentUsed.toFixed(1)}%`,
      ];
    }),
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
