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
import { buildProjectAliases, computeProjectFinancialSnapshot } from "@/lib/projects";

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
  overdueRecoveryAmount: number;
  overdueInvoiceCount: number;
  negativeMargin: boolean;
  highVendorExposure: boolean;
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
  const canViewFinancials =
    (await requirePermission(session.user.id, "projects.view_financials")) ||
    (await requirePermission(session.user.id, "dashboard.view_all_metrics"));
  if ((!canViewAll && !canViewAssigned) || !canViewFinancials) {
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
    orderBy: [{ name: "asc" }],
    include: { client: true },
  });

  const projectsWithExpenseData = await Promise.all(
    projects.map(async (project) => {
      const aliases = buildProjectAliases(project);
      const [snapshot, expenseData, latestExpense] = await Promise.all([
        computeProjectFinancialSnapshot(project),
        prisma.expense.aggregate({
          where: { project: { in: aliases } },
          _count: true,
        }),
        prisma.expense.findFirst({
          where: { project: { in: aliases } },
          orderBy: { date: "desc" },
          select: { date: true },
        }),
      ]);

      const row: FinancialProjectRow = {
        id: project.id,
        projectId: project.projectId,
        name: project.name,
        clientName: project.client?.name || "",
        contractValue: snapshot.contractValue,
        costToDate: snapshot.costToDate,
        receivedAmount: snapshot.receivedAmount,
        invoicedAmount: snapshot.invoicedAmount,
        pendingRecovery: snapshot.pendingRecovery,
        grossMargin: snapshot.grossMargin,
        marginPercent: snapshot.marginPercent,
        status: project.status,
        expenseCount: expenseData._count,
        lastExpenseDate: latestExpense?.date ? latestExpense.date.toISOString() : null,
        overdueRecoveryAmount: snapshot.overdueRecoveryAmount,
        overdueInvoiceCount: snapshot.overdueInvoiceCount || 0,
        negativeMargin: snapshot.negativeMargin,
        highVendorExposure: snapshot.highUnpaidVendorExposure,
      };

      return row;
    })
  );

  projectsWithExpenseData.sort((a, b) => b.costToDate - a.costToDate || a.name.localeCompare(b.name));

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
  const totalOverdueRecovery = filtered.reduce((sum, p) => sum + Number(p.overdueRecoveryAmount), 0);
  const highRiskCount = filtered.filter(
    (p) => p.negativeMargin || p.overdueRecoveryAmount > 0 || p.highVendorExposure,
  ).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / take));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * take;
  const pageProjects = filtered.slice(pageStart, pageStart + take);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-emerald-500/10 p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Project Financial Dashboard</h1>
            <p className="mt-2 text-muted-foreground">Live view of project cash in, cash out, recoveries, and risk signals.</p>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <Card className="border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <CardHeader>
            <CardTitle>Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatMoney(totalContractValue)}</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-950/30">
          <CardHeader>
            <CardTitle>Total Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">{formatMoney(totalCostToDate)}</p>
          </CardContent>
        </Card>

        <Card className="border-sky-500/30 bg-sky-500/10 dark:border-sky-900/60 dark:bg-sky-950/30">
          <CardHeader>
            <CardTitle>Money In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">{formatMoney(totalReceived)}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/10 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle>Pending Recovery</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalPendingRecovery > 0 ? "text-amber-900 dark:text-amber-100" : "text-foreground"}`}>
              {formatMoney(totalPendingRecovery)}
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            totalGrossMargin >= 0
              ? "border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-900/60 dark:bg-emerald-950/30"
              : "border-rose-500/30 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-950/30"
          }
        >
          <CardHeader>
            <CardTitle>Current Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalGrossMargin >= 0 ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100"}`}>
              {formatMoney(totalGrossMargin)}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalReceived > 0 ? `${((totalGrossMargin / totalReceived) * 100).toFixed(1)}% margin` : "No approved income yet"}
            </p>
          </CardContent>
        </Card>
        <Card className={totalOverdueRecovery > 0 ? "border-rose-500/30 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-950/30" : "border-border bg-muted/30"}>
          <CardHeader>
            <CardTitle>Overdue Recovery</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalOverdueRecovery > 0 ? "text-rose-900 dark:text-rose-100" : "text-foreground"}`}>
              {formatMoney(totalOverdueRecovery)}
            </p>
          </CardContent>
        </Card>
        <Card className={highRiskCount > 0 ? "border-rose-500/30 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-950/30" : "border-border bg-muted/30"}>
          <CardHeader>
            <CardTitle>Cash Risk Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${highRiskCount > 0 ? "text-rose-900 dark:text-rose-100" : "text-foreground"}`}>
              {highRiskCount}
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
            <Card
              key={project.id}
              className={
                isOverBudget
                  ? "border-rose-500/30 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-950/20"
                  : "border-border bg-card/95"
              }
            >
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {project.projectId} • {project.clientName || "Unknown client"}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                    {project.status.replaceAll("_", " ")}
                  </span>
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
                    <Progress value={costPercentage} className={isOverBudget ? "bg-rose-500/20" : ""} />
                  ) : (
                    <div className="h-2 rounded bg-muted/40">
                      <div className="text-xs text-center text-muted-foreground pt-0.5">No budget set</div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{costPercentage.toFixed(1)}% spent</span>
                    {isOverBudget ? <span className="font-medium text-rose-700 dark:text-rose-300">Over Budget!</span> : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 text-sm">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Contract</p>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(project.contractValue)}</p>
                  </div>
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
                    <p className="text-xs text-rose-700 dark:text-rose-300">Cost to date</p>
                    <p className="font-semibold text-rose-900 dark:text-rose-100">{formatMoney(project.costToDate)}</p>
                  </div>
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
                    <p className="text-xs text-sky-700 dark:text-sky-300">Money in</p>
                    <p className="font-semibold text-sky-900 dark:text-sky-100">{formatMoney(project.receivedAmount)}</p>
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                    <p className="text-xs text-amber-700 dark:text-amber-300">Pending recovery</p>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">{formatMoney(project.pendingRecovery)}</p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${
                      project.grossMargin >= 0
                        ? "border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                        : "border-rose-500/30 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-950/30"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground">Current profit</p>
                    <p className="font-semibold text-foreground">{formatMoney(project.grossMargin)}</p>
                    <p className="text-xs text-muted-foreground">{project.marginPercent.toFixed(1)}%</p>
                  </div>
                </div>

                  {(project.negativeMargin || project.overdueRecoveryAmount > 0 || project.highVendorExposure) ? (
                    <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                      <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">Cash Risk Signals</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {project.negativeMargin ? (
                          <span className="rounded-full bg-rose-500/15 px-2 py-1 font-medium text-rose-700 dark:text-rose-300">
                            Negative margin
                          </span>
                        ) : null}
                        {project.overdueRecoveryAmount > 0 ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-1 font-medium text-amber-800 dark:text-amber-200">
                            Overdue recovery {formatMoney(project.overdueRecoveryAmount)} ({project.overdueInvoiceCount} invoice)
                          </span>
                        ) : null}
                        {project.highVendorExposure ? (
                          <span className="rounded-full bg-orange-500/15 px-2 py-1 font-medium text-orange-800 dark:text-orange-200">
                            Vendor exposure high
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

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
                    <div className="h-2 rounded bg-muted/40">
                      <div className="text-xs text-center text-muted-foreground pt-0.5">No invoices yet</div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{recoveryPercent.toFixed(1)}% recovered</span>
                    {project.pendingRecovery > 0 ? <span className="font-medium text-amber-700 dark:text-amber-300">Pending recovery</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Link href={`/expenses/by-project?project=${encodeURIComponent(project.projectId)}`}>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      View Expenses
                    </Button>
                  </Link>
                  <Link href={`/income?search=${encodeURIComponent(project.projectId)}`}>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      View Income
                    </Button>
                  </Link>
                  <Link href={`/procurement/vendor-bills?search=${encodeURIComponent(project.projectId)}`}>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      Vendor Bills
                    </Button>
                  </Link>
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
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
