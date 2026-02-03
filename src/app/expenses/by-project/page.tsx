import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/rbac";

export default async function ExpensesByProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  if (!canViewAll && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Expenses by Project</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to expenses.</p>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.project;

  // Get all expenses grouped by project
  const expenses = await prisma.expense.findMany({
    where: projectId ? { project: projectId } : {},
    orderBy: { date: "desc" },
    take: 100,
    include: {
      submittedBy: {
        select: { name: true, email: true },
      },
    },
  });

  // Group expenses by project
  const projectIds = Array.from(new Set(expenses.map((expense) => expense.project)));
  const projects = await prisma.project.findMany({
    where: { projectId: { in: projectIds } },
    include: { client: true },
  });
  const projectMap = new Map(projects.map((project) => [project.projectId, project]));

  const expensesByProject = expenses.reduce((acc, expense) => {
    const project = expense.project || "UNKNOWN";
    if (!acc[project]) {
      acc[project] = [];
    }
    acc[project].push(expense);
    return acc;
  }, {} as Record<string, typeof expenses>);

  // Calculate totals per project
  const projectSummaries = Object.entries(expensesByProject).map(([project, projectExpenses]) => {
    const total = projectExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const projectInfo = projectMap.get(project);
    return {
      project,
      projectName: projectInfo?.name || project,
      clientName: projectInfo?.client?.name || "-",
      expenses: projectExpenses,
      total,
      count: projectExpenses.length,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {projectId ? `Expenses for: ${projectId}` : "Expenses by Project/Client"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {projectId 
                ? "All expenses recorded for this project" 
                : "View all expenses grouped by project"}
            </p>
          </div>
          {projectId && (
            <Link
              href="/expenses/by-project"
              className="text-sm text-primary hover:underline"
            >
              ← View All Projects
            </Link>
          )}
        </div>
      </div>

      {projectSummaries.map(({ project, projectName, clientName, expenses: projectExpenses, total, count }) => (
        <div key={project} className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{projectName}</h2>
              <p className="text-sm text-muted-foreground">
                {clientName} • {count} expenses • Total: {formatMoney(total)}
              </p>
            </div>
            <Link
              href={`/reports/projects`}
              className="text-sm text-primary hover:underline"
            >
              View Project Report →
            </Link>
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Submitted By</th>
                </tr>
              </thead>
              <tbody>
                {projectExpenses.map((expense) => (
                  <tr key={expense.id} className="border-b">
                    <td className="py-2">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="py-2">{expense.description}</td>
                    <td className="py-2">{expense.category}</td>
                    <td className="py-2 font-semibold">
                      {formatMoney(Number(expense.amount))}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        expense.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        expense.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs">
                      {expense.submittedBy?.name || expense.submittedBy?.email || 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {projectExpenses.map((expense) => (
              <div key={expense.id} className="border rounded-lg p-3">
                <div className="font-medium mb-2">{expense.description}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold">{formatMoney(Number(expense.amount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{expense.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span>{expense.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date(expense.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">By:</span>
                    <span>{expense.submittedBy?.name || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {projectSummaries.length === 0 && (
        <div className="rounded-xl border bg-card p-12 shadow-sm text-center">
          <p className="text-muted-foreground">
            No expenses found. Submit expenses with project IDs to see them here.
          </p>
        </div>
      )}
    </div>
  );
}
