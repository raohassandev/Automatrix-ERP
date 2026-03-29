import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import DateRangePicker from "@/components/DateRangePicker";
import QuerySelect from "@/components/QuerySelect";
import { normalizeExpenseAmount } from "@/lib/employee-finance";

function hrefWithQuery(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

type ExpenseViewRow = {
  id: string;
  date: Date;
  amount: number;
  approvedAmount: number;
  status: string;
  project: string | null;
  description: string;
  category: string;
  paymentSource: string | null;
  submittedById: string | null;
  submittedByName: string;
  submittedByEmail: string;
};

export default async function EmployeeExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    from?: string;
    to?: string;
    submittedById?: string;
    category?: string;
    paymentSource?: string;
    project?: string;
    status?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }
  const params = await searchParams;

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canExport = await requirePermission(session.user.id, "reports.export");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Expense Analytics</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const search = (params.search || "").trim();
  const from = (params.from || "").trim();
  const to = (params.to || "").trim();
  const submittedById = (params.submittedById || "").trim();
  const category = (params.category || "").trim();
  const paymentSource = (params.paymentSource || "").trim();
  const project = (params.project || "").trim();
  const status = (params.status || "").trim();

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

  const optionWhere: import("@prisma/client").Prisma.ExpenseWhereInput = {
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
  };
  if (!canViewAll && !canViewTeam) {
    optionWhere.submittedById = session.user.id;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    optionWhere.date = range;
  }

  const [expensesRaw, optionRows] = await Promise.all([
    prisma.expense.findMany({
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
    }),
    prisma.expense.findMany({
      where: optionWhere,
      select: {
        category: true,
        paymentSource: true,
        project: true,
        submittedById: true,
        submittedBy: { select: { name: true, email: true } },
      },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  const expenses: ExpenseViewRow[] = expensesRaw.map((row) => ({
    id: row.id,
    date: new Date(row.date),
    amount: Number(row.amount),
    approvedAmount: Number(normalizeExpenseAmount(row)),
    status: row.status,
    project: row.project,
    description: row.description,
    category: row.category,
    paymentSource: row.paymentSource,
    submittedById: row.submittedById,
    submittedByName: row.submittedBy?.name || "Unknown",
    submittedByEmail: row.submittedBy?.email || "unknown",
  }));

  const employeeSummaryMap = new Map<string, { submittedById: string; name: string; email: string; claims: number; total: number }>();
  const categorySummaryMap = new Map<string, { category: string; claims: number; total: number; pocket: number; wallet: number; company: number }>();
  const monthlySummaryMap = new Map<string, { month: string; claims: number; total: number; pocket: number; reimbursed: number }>();

  expenses.forEach((row) => {
    const employeeKey = row.submittedById || "unknown";
    const employeeEntry = employeeSummaryMap.get(employeeKey) || {
      submittedById: employeeKey,
      name: row.submittedByName,
      email: row.submittedByEmail,
      claims: 0,
      total: 0,
    };
    employeeEntry.claims += 1;
    employeeEntry.total += row.approvedAmount;
    employeeSummaryMap.set(employeeKey, employeeEntry);

    const categoryEntry = categorySummaryMap.get(row.category) || {
      category: row.category,
      claims: 0,
      total: 0,
      pocket: 0,
      wallet: 0,
      company: 0,
    };
    categoryEntry.claims += 1;
    categoryEntry.total += row.approvedAmount;
    if (row.paymentSource === "EMPLOYEE_POCKET") categoryEntry.pocket += row.approvedAmount;
    else if (row.paymentSource === "EMPLOYEE_WALLET") categoryEntry.wallet += row.approvedAmount;
    else categoryEntry.company += row.approvedAmount;
    categorySummaryMap.set(row.category, categoryEntry);

    const month = monthLabel(row.date);
    const monthEntry = monthlySummaryMap.get(month) || {
      month,
      claims: 0,
      total: 0,
      pocket: 0,
      reimbursed: 0,
    };
    monthEntry.claims += 1;
    monthEntry.total += row.approvedAmount;
    if (row.paymentSource === "EMPLOYEE_POCKET" && (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED")) {
      monthEntry.pocket += row.approvedAmount;
    }
    if (row.paymentSource === "EMPLOYEE_POCKET" && row.status === "PAID") {
      monthEntry.reimbursed += row.approvedAmount;
    }
    monthlySummaryMap.set(month, monthEntry);
  });

  const employeeSummary = Array.from(employeeSummaryMap.values())
    .map((row) => ({ ...row, averageClaim: row.claims > 0 ? row.total / row.claims : 0 }))
    .sort((a, b) => b.total - a.total);
  const categorySummary = Array.from(categorySummaryMap.values())
    .map((row) => ({ ...row, averageClaim: row.claims > 0 ? row.total / row.claims : 0 }))
    .sort((a, b) => b.total - a.total);
  const monthlySummary = Array.from(monthlySummaryMap.values())
    .map((row) => ({ ...row, averageClaim: row.claims > 0 ? row.total / row.claims : 0 }))
    .sort((a, b) => new Date(`01 ${b.month}`).getTime() - new Date(`01 ${a.month}`).getTime());

  const totalApproved = expenses.reduce((sum, row) => sum + row.approvedAmount, 0);
  const averageClaim = expenses.length > 0 ? totalApproved / expenses.length : 0;
  const averageMonth = monthlySummary.length > 0 ? totalApproved / monthlySummary.length : 0;

  const employeeOptions = Array.from(
    new Map(
      optionRows
        .filter((row) => row.submittedById && row.submittedBy?.email)
        .map((row) => {
          const email = row.submittedBy?.email || "";
          const name = row.submittedBy?.name || email;
          return [row.submittedById!, { value: row.submittedById!, label: `${name} (${email})` }];
        }),
    ).values(),
  );
  const categoryOptions = Array.from(new Set(optionRows.map((row) => row.category).filter(Boolean) as string[])).sort();
  const paymentSourceOptions = Array.from(new Set(optionRows.map((row) => row.paymentSource).filter(Boolean) as string[])).sort();
  const projectOptions = Array.from(new Set(optionRows.map((row) => row.project).filter(Boolean) as string[])).sort();

  const exportQuery = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    submittedById: submittedById || undefined,
    category: category || undefined,
    paymentSource: paymentSource || undefined,
    project: project || undefined,
    status: status || undefined,
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Employee Expense Analytics</h1>
            <p className="mt-2 text-muted-foreground">
              Category, month, employee, and source analysis for approved employee expenses with direct drilldown to exact rows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            {(canViewAll || canViewTeam) ? (
              <QuerySelect param="submittedById" placeholder="All employees" options={employeeOptions} className="min-w-[220px] rounded-md border px-3 py-2 text-sm" />
            ) : null}
            <QuerySelect param="category" placeholder="All categories" options={categoryOptions.map((value) => ({ value, label: value }))} />
            <QuerySelect param="paymentSource" placeholder="All payment sources" options={paymentSourceOptions.map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
            <QuerySelect param="project" placeholder="All projects" options={projectOptions.map((value) => ({ value, label: value }))} className="min-w-[180px] rounded-md border px-3 py-2 text-sm" />
            <QuerySelect
              param="status"
              placeholder="Approved states"
              options={[
                { label: "Approved", value: "APPROVED" },
                { label: "Partially Approved", value: "PARTIALLY_APPROVED" },
                { label: "Paid", value: "PAID" },
              ]}
            />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee, category, project..." />
            </div>
            {canExport ? (
              <>
                <a href={hrefWithQuery("/api/reports/employee-expenses/export", { ...exportQuery, mode: "detail" })} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
                  Export Detail CSV
                </a>
                <a href={hrefWithQuery("/api/reports/employee-expenses/export", { ...exportQuery, mode: "summary" })} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
                  Export Summary CSV
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Approved</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalApproved)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Records</div>
          <div className="mt-2 text-xl font-semibold">{expenses.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Employees</div>
          <div className="mt-2 text-xl font-semibold">{employeeSummary.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Average Claim</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(averageClaim)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Average Per Month</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(averageMonth)}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Employee Summary</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Employee</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Claims</th>
                  <th className="py-2">Total Approved</th>
                  <th className="py-2">Avg Claim</th>
                  <th className="py-2">Drill</th>
                </tr>
              </thead>
              <tbody>
                {employeeSummary.map((row) => (
                  <tr key={row.submittedById} className="border-b">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td className="py-2">{row.email}</td>
                    <td className="py-2">{row.claims}</td>
                    <td className="py-2">{formatMoney(row.total)}</td>
                    <td className="py-2">{formatMoney(row.averageClaim)}</td>
                    <td className="py-2">
                      <a href={hrefWithQuery("/expenses", {
                        submittedById: row.submittedById,
                        from: from || undefined,
                        to: to || undefined,
                        category: category || undefined,
                        paymentSource: paymentSource || undefined,
                        project: project || undefined,
                      })} className="text-primary underline underline-offset-2">
                        Open rows
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {employeeSummary.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No expense records found.</div> : null}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Category Summary</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Category</th>
                  <th className="py-2">Claims</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Avg Claim</th>
                  <th className="py-2">Pocket</th>
                  <th className="py-2">Wallet</th>
                  <th className="py-2">Company</th>
                </tr>
              </thead>
              <tbody>
                {categorySummary.map((row) => (
                  <tr key={row.category} className="border-b">
                    <td className="py-2 font-medium">{row.category}</td>
                    <td className="py-2">{row.claims}</td>
                    <td className="py-2">{formatMoney(row.total)}</td>
                    <td className="py-2">{formatMoney(row.averageClaim)}</td>
                    <td className="py-2">{formatMoney(row.pocket)}</td>
                    <td className="py-2">{formatMoney(row.wallet)}</td>
                    <td className="py-2">{formatMoney(row.company)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {categorySummary.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No category rows found.</div> : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Monthly Summary</h2>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Month</th>
                <th className="py-2">Claims</th>
                <th className="py-2">Total Approved</th>
                <th className="py-2">Avg Claim</th>
                <th className="py-2">Pocket Payable</th>
                <th className="py-2">Reimbursed</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((row) => (
                <tr key={row.month} className="border-b">
                  <td className="py-2 font-medium">{row.month}</td>
                  <td className="py-2">{row.claims}</td>
                  <td className="py-2">{formatMoney(row.total)}</td>
                  <td className="py-2">{formatMoney(row.averageClaim)}</td>
                  <td className="py-2">{formatMoney(row.pocket)}</td>
                  <td className="py-2">{formatMoney(row.reimbursed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {monthlySummary.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No monthly rows found.</div> : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Detailed Rows</h2>
            <p className="mt-1 text-sm text-muted-foreground">Exact expense rows for the active filter set.</p>
          </div>
          <div className="text-sm text-muted-foreground">{expenses.length} rows</div>
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Category</th>
                <th className="py-2">Project</th>
                <th className="py-2">Source</th>
                <th className="py-2">Status</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Approved</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2">{row.date.toLocaleDateString()}</td>
                  <td className="py-2">{row.submittedByName}</td>
                  <td className="py-2">{row.category}</td>
                  <td className="py-2">{row.project || "-"}</td>
                  <td className="py-2">{row.paymentSource || "-"}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">{formatMoney(row.amount)}</td>
                  <td className="py-2">{formatMoney(row.approvedAmount)}</td>
                  <td className="py-2">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenses.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No expense rows found.</div> : null}
      </div>
    </div>
  );
}
