import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { redirect } from "next/navigation";
import Link from "next/link";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { requirePermission } from "@/lib/rbac";

export default async function ProjectExpensesReportPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canExport = await requirePermission(session.user.id, "reports.export");
  const canView = canViewAll || canViewTeam || canViewOwn;
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Project-Wise Expense Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

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
  const baseWhere: import("@prisma/client").Prisma.ProjectWhereInput =
    !canViewAll && !canViewTeam && canViewOwn
      ? ownProjectIds.length > 0
        ? { id: { in: ownProjectIds } }
        : { id: "__none__" }
      : {};

  const where: import("@prisma/client").Prisma.ProjectWhereInput = search
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

  // Get paged projects
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
      include: { client: true },
      skip,
      take,
    }),
    prisma.project.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));

  // Get expense totals per project
  const projectExpenses = await Promise.all(
    projects.map(async (project) => {
      // Match expenses by project name (expenses.project field stores project name as string)
      const expenses = await prisma.expense.aggregate({
        where: { project: { in: [project.projectId, project.name] } },
        _sum: { amount: true },
        _count: true,
      });

      return {
        project,
        totalExpenses: expenses._sum.amount || 0,
        expenseCount: expenses._count || 0,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Project-Wise Expense Report</h1>
            <p className="mt-2 text-muted-foreground">
              View expenses grouped by project
            </p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search projects..." />
          </div>
          {canExport ? (
            <Link
              href={`/api/reports/projects/export?${new URLSearchParams({
                ...(search ? { search } : {}),
              }).toString()}`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export CSV
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Project</th>
                <th className="py-2">Client</th>
                <th className="py-2">Status</th>
                <th className="py-2"># Expenses</th>
                <th className="py-2">Total Expenses</th>
                <th className="py-2">Contract Value</th>
                <th className="py-2">Cost %</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectExpenses.map(({ project, totalExpenses, expenseCount }) => {
                const contractValue = Number(project.contractValue);
                const costToDate = Number(project.costToDate);
                const percentUsed = contractValue > 0 ? (costToDate / contractValue) * 100 : 0;
                const isOverBudget = percentUsed > 100;

                return (
                  <tr key={project.id} className="border-b">
                    <td className="py-2 font-medium">{project.name}</td>
                    <td className="py-2">{project.client?.name || '-'}</td>
                    <td className="py-2">{project.status}</td>
                    <td className="py-2">{expenseCount}</td>
                    <td className="py-2">{formatMoney(Number(totalExpenses))}</td>
                    <td className="py-2">{formatMoney(contractValue)}</td>
                    <td className={`py-2 ${isOverBudget ? 'text-destructive font-semibold' : ''}`}>
                      {percentUsed.toFixed(1)}%
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/expenses?project=${encodeURIComponent(project.projectId)}`}
                        className="text-primary hover:underline text-sm"
                      >
                        View Expenses
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-4">
          {projectExpenses.map(({ project, totalExpenses, expenseCount }) => {
            const contractValue = Number(project.contractValue);
            const costToDate = Number(project.costToDate);
            const percentUsed = contractValue > 0 ? (costToDate / contractValue) * 100 : 0;
            const isOverBudget = percentUsed > 100;

            return (
              <div key={project.id} className="border rounded-lg p-4">
                <div className="font-semibold text-base mb-2">{project.name}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span>{project.client?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span>{project.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"># Expenses:</span>
                    <span>{expenseCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Expenses:</span>
                    <span className="font-semibold">{formatMoney(Number(totalExpenses))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract Value:</span>
                    <span>{formatMoney(contractValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost %:</span>
                    <span className={isOverBudget ? 'text-destructive font-semibold' : ''}>
                      {percentUsed.toFixed(1)}%
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <Link
                      href={`/expenses?project=${encodeURIComponent(project.projectId)}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View Expenses →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {projectExpenses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No projects found. Create a project to track expenses.
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
