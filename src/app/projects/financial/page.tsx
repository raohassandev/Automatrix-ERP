import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import SearchInput from "@/components/SearchInput";
import QuerySelect from "@/components/QuerySelect";
import PaginationControls from "@/components/PaginationControls";

type FinancialProjectRow = {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  contractValue: number;
  costToDate: number;
  receivedAmount: number;
  invoicedAmount: number;
  pendingRecovery: number;
  grossMargin: number;
  marginPercent: number;
  status: string;
  expenseCount: number;
  lastExpenseDate: string | null;
};

export default async function ProjectFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "projects.view_all");
  const canViewAssigned = await requirePermission(session.user.id, "projects.view_assigned");
  if (!canViewAll && !canViewAssigned) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Project Financials</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to project financials.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const statusFilter = (params.status || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 10;

  let where: { id?: { in: string[] } } | undefined = undefined;
  if (!canViewAll && canViewAssigned) {
    const assignments = await prisma.projectAssignment.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    const projectIds = assignments.map((assignment) => assignment.projectId);
    if (projectIds.length === 0) {
      return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Project Financial Dashboard</h1>
          <p className="mt-2 text-muted-foreground">No assigned projects found.</p>
        </div>
      );
    }
    where = { id: { in: projectIds } };
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: [{ costToDate: "desc" }, { name: "asc" }],
    include: { client: true },
  });

  const projectsWithExpenseData = await Promise.all(
    projects.map(async (project) => {
      const expenseData = await prisma.expense.aggregate({
        where: { project: { in: [project.projectId, project.name] } },
        _count: true,
      });

      const latestExpense = await prisma.expense.findFirst({
        where: { project: { in: [project.projectId, project.name] } },
        orderBy: { date: "desc" },
        select: { date: true },
      });

      const row: FinancialProjectRow = {
        id: project.id,
        projectId: project.projectId,
        name: project.name,
        clientName: project.client?.name || "",
        contractValue: Number(project.contractValue),
        costToDate: Number(project.costToDate),
        receivedAmount: Number(project.receivedAmount),
        invoicedAmount: Number(project.invoicedAmount),
        pendingRecovery: Number(project.pendingRecovery),
        grossMargin: Number(project.grossMargin),
        marginPercent: Number(project.marginPercent),
        status: project.status,
        expenseCount: expenseData._count,
        lastExpenseDate: latestExpense?.date ? latestExpense.date.toISOString() : null,
      };

      return row;
    })
  );

  const statusOptions = Array.from(
    new Set(projectsWithExpenseData.map((p) => p.status).filter(Boolean))
  )
    .sort()
    .map((value) => ({ label: value, value }));

  const normalizedSearch = search.toLowerCase();
  const filtered = projectsWithExpenseData.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    const haystack = [p.name, p.projectId, p.clientName, p.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const totalContractValue = filtered.reduce((sum, p) => sum + Number(p.contractValue), 0);
  const totalCostToDate = filtered.reduce((sum, p) => sum + Number(p.costToDate), 0);
  const totalReceived = filtered.reduce((sum, p) => sum + Number(p.receivedAmount), 0);
  const totalPendingRecovery = filtered.reduce((sum, p) => sum + Number(p.pendingRecovery), 0);
  const totalGrossMargin = filtered.reduce((sum, p) => sum + Number(p.grossMargin), 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / take));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * take;
  const pageProjects = filtered.slice(pageStart, pageStart + take);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Project Financial Dashboard</h1>
            <p className="mt-2 text-muted-foreground">Budget vs actual costs and profitability analysis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search projects..." />
            </div>
            <QuerySelect param="status" placeholder="All statuses" options={statusOptions} />
            <Link href="/projects">
              <Button variant="outline">View All Projects</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatMoney(totalContractValue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatMoney(totalCostToDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatMoney(totalReceived)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Recovery</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalPendingRecovery > 0 ? "text-amber-600" : "text-foreground"}`}>
              {formatMoney(totalPendingRecovery)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gross Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalGrossMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatMoney(totalGrossMargin)}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalContractValue > 0 ? `${((totalGrossMargin / totalContractValue) * 100).toFixed(1)}% margin` : "No contract values set"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {pageProjects.map((project) => {
          const costPercentage =
            project.contractValue > 0 ? Math.min((project.costToDate / project.contractValue) * 100, 100) : 0;
          const isOverBudget = project.contractValue > 0 && project.costToDate > project.contractValue;
          const recoveryPercent =
            project.invoicedAmount > 0 ? Math.min((project.receivedAmount / project.invoicedAmount) * 100, 100) : 0;

          return (
            <Card key={project.id} className={isOverBudget ? "border-red-200" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {project.projectId} • {project.clientName || "Unknown client"} • {project.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {project.expenseCount} expenses
                      {project.lastExpenseDate ? <> • Last: {new Date(project.lastExpenseDate).toLocaleDateString()}</> : null}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Budget Progress</span>
                    <span>
                      {formatMoney(project.costToDate)} / {formatMoney(project.contractValue)}
                    </span>
                  </div>
                  {project.contractValue > 0 ? (
                    <Progress value={costPercentage} className={isOverBudget ? "bg-red-100" : ""} />
                  ) : (
                    <div className="bg-gray-100 h-2 rounded">
                      <div className="text-xs text-center text-muted-foreground pt-0.5">No budget set</div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{costPercentage.toFixed(1)}% spent</span>
                    {isOverBudget ? <span className="text-red-600 font-medium">Over Budget!</span> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contract Value</p>
                    <p className="font-semibold text-green-600">{formatMoney(project.contractValue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actual Costs</p>
                    <p className="font-semibold text-red-600">{formatMoney(project.costToDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Received</p>
                    <p className="font-semibold text-blue-600">{formatMoney(project.receivedAmount)}</p>
                    <p className="text-xs text-muted-foreground">Pending: {formatMoney(project.pendingRecovery)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gross Margin</p>
                    <p className={`font-semibold ${project.grossMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatMoney(project.grossMargin)}
                    </p>
                    <p className="text-xs text-muted-foreground">{project.marginPercent.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Recovery Progress</span>
                    <span>
                      {formatMoney(project.receivedAmount)} / {formatMoney(project.invoicedAmount)}
                    </span>
                  </div>
                  {project.invoicedAmount > 0 ? (
                    <Progress value={recoveryPercent} />
                  ) : (
                    <div className="bg-gray-100 h-2 rounded">
                      <div className="text-xs text-center text-muted-foreground pt-0.5">No invoices yet</div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{recoveryPercent.toFixed(1)}% recovered</span>
                    {project.pendingRecovery > 0 ? <span className="text-amber-600 font-medium">Pending recovery</span> : null}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Link href={`/expenses/by-project?project=${encodeURIComponent(project.projectId)}`}>
                    <Button variant="outline" size="sm">
                      View Expenses
                    </Button>
                  </Link>
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="outline" size="sm">
                      Project Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No projects found with financial data.</p>
          </CardContent>
        </Card>
      ) : null}

      {totalPages > 1 ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <PaginationControls totalPages={totalPages} currentPage={safePage} />
        </div>
      ) : null}
    </div>
  );
}

