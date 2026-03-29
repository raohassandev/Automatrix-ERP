import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import QuerySelect from "@/components/QuerySelect";
import DateRangePicker from "@/components/DateRangePicker";
import Link from "next/link";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

export default async function WalletLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    type?: string;
    sourceType?: string;
    from?: string;
    to?: string;
    employeeId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }
  const params = await searchParams;

  const canViewAll = await requirePermission(session.user.id, "employees.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canEdit = await requirePermission(session.user.id, "employees.edit_wallet");

  if (!canViewAll && !canViewOwn && !canEdit) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Wallet Ledger</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to wallet ledger.</p>
      </div>
    );
  }

  const search = (params.search || "").trim();
  const type = (params.type || "").trim();
  const sourceType = (params.sourceType || "").trim();
  const employeeId = (params.employeeId || "").trim();
  const from = params.from;
  const to = params.to;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const ownEmployee = session.user.email
    ? await findEmployeeByEmailInsensitive(session.user.email, { select: { id: true, name: true, email: true } })
    : null;

  const employeeOptionsRaw = await prisma.employee.findMany({
    where: canViewAll || canEdit ? {} : ownEmployee?.id ? { id: ownEmployee.id } : { id: "__none__" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  let baseWhere: import("@prisma/client").Prisma.WalletLedgerWhereInput = {};
  if (!canViewAll && !canEdit) {
    if (ownEmployee?.id) {
      baseWhere = { employeeId: ownEmployee.id };
    } else {
      baseWhere = { employeeId: "__none__" };
    }
  }

  if (employeeId) {
    if (!canViewAll && !canEdit && employeeId !== ownEmployee?.id) {
      baseWhere = { employeeId: "__none__" };
    } else {
      baseWhere = { ...baseWhere, employeeId };
    }
  }

  const where: import("@prisma/client").Prisma.WalletLedgerWhereInput = { ...baseWhere };
  if (search) {
    where.AND = [
      baseWhere,
      {
        OR: [
          { reference: { contains: search, mode: "insensitive" as const } },
          { employee: { name: { contains: search, mode: "insensitive" as const } } },
          { employee: { email: { contains: search, mode: "insensitive" as const } } },
        ],
      },
    ];
  }
  if (type) {
    where.type = type;
  }
  if (sourceType) {
    where.sourceType = sourceType;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const [ledgers, analysisRows, total, openingBalanceRow, closingBalanceRow] = await Promise.all([
    prisma.walletLedger.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        employee: true,
        companyAccount: { select: { id: true, name: true, type: true } },
        postedBy: { select: { id: true, name: true, email: true } },
      },
      skip,
      take,
    }),
    prisma.walletLedger.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { id: true, date: true, type: true, amount: true, balance: true, sourceType: true, employeeId: true },
    }),
    prisma.walletLedger.count({ where }),
    employeeId
      ? prisma.walletLedger.findFirst({
          where: { employeeId, ...(from ? { date: { lt: new Date(from) } } : {}) },
          orderBy: { date: "desc" },
          select: { balance: true },
        })
      : Promise.resolve(null),
    employeeId
      ? prisma.walletLedger.findFirst({
          where: { employeeId, ...(to ? { date: { lte: new Date(to) } } : {}) },
          orderBy: { date: "desc" },
          select: { balance: true },
        })
      : Promise.resolve(null),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const credits = analysisRows.filter((row) => row.type === "CREDIT").reduce((sum, row) => sum + Number(row.amount), 0);
  const debits = analysisRows.filter((row) => row.type === "DEBIT").reduce((sum, row) => sum + Number(row.amount), 0);
  const netMovement = credits - debits;
  const uniqueEmployees = new Set(analysisRows.map((row) => row.employeeId)).size;
  const openingBalance = Number(openingBalanceRow?.balance || 0);
  const closingBalance = Number(closingBalanceRow?.balance || 0);

  const sourceSummaryMap = new Map<string, { sourceType: string; count: number; credits: number; debits: number }>();
  const monthlySummaryMap = new Map<string, { month: string; credits: number; debits: number; rows: number }>();

  analysisRows.forEach((row) => {
    const sourceKey = row.sourceType || "UNSPECIFIED";
    const sourceEntry = sourceSummaryMap.get(sourceKey) || { sourceType: sourceKey, count: 0, credits: 0, debits: 0 };
    sourceEntry.count += 1;
    if (row.type === "CREDIT") sourceEntry.credits += Number(row.amount);
    else sourceEntry.debits += Number(row.amount);
    sourceSummaryMap.set(sourceKey, sourceEntry);

    const month = monthLabel(new Date(row.date));
    const monthEntry = monthlySummaryMap.get(month) || { month, credits: 0, debits: 0, rows: 0 };
    monthEntry.rows += 1;
    if (row.type === "CREDIT") monthEntry.credits += Number(row.amount);
    else monthEntry.debits += Number(row.amount);
    monthlySummaryMap.set(month, monthEntry);
  });

  const sourceSummary = Array.from(sourceSummaryMap.values())
    .map((row) => ({ ...row, net: row.credits - row.debits }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const monthlySummary = Array.from(monthlySummaryMap.values())
    .map((row) => ({ ...row, net: row.credits - row.debits }))
    .sort((a, b) => new Date(`01 ${b.month}`).getTime() - new Date(`01 ${a.month}`).getTime());

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Wallet Ledger</h1>
            <p className="mt-2 text-muted-foreground">Employee wallet transactions with funding-source totals and monthly movement.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee or reference..." />
            </div>
            {(canViewAll || canEdit) ? (
              <QuerySelect
                param="employeeId"
                placeholder="All employees"
                options={employeeOptionsRaw.map((row) => ({ value: row.id, label: `${row.name} (${row.email})` }))}
                className="min-w-[220px] rounded-md border px-3 py-2 text-sm"
              />
            ) : null}
            <QuerySelect
              param="type"
              placeholder="All types"
              options={[
                { label: "Credit", value: "CREDIT" },
                { label: "Debit", value: "DEBIT" },
              ]}
            />
            <QuerySelect
              param="sourceType"
              placeholder="All sources"
              options={[
                { label: "Top-up", value: "WALLET_TOPUP" },
                { label: "Adjustment", value: "WALLET_ADJUSTMENT" },
                { label: "Expense Hold", value: "EXPENSE_HOLD" },
                { label: "Expense Release", value: "EXPENSE_HOLD_RELEASE" },
                { label: "Expense Settlement", value: "EXPENSE_SETTLEMENT" },
                { label: "Payroll", value: "PAYROLL" },
                { label: "Advance", value: "SALARY_ADVANCE" },
                { label: "Company Advance Issue", value: "COMPANY_ADVANCE_ISSUE" },
                { label: "Company Advance Adjustment", value: "COMPANY_ADVANCE_ADJUSTMENT" },
                { label: "Reimbursement", value: "REIMBURSEMENT" },
                { label: "Incentive", value: "INCENTIVE" },
                { label: "Commission", value: "COMMISSION" },
              ]}
            />
            <Link
              href={`/api/wallets/export?${new URLSearchParams({
                ...(search ? { search } : {}),
                ...(type ? { type } : {}),
                ...(sourceType ? { sourceType } : {}),
                ...(employeeId ? { employeeId } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
              }).toString()}`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export CSV
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Matching Rows</div>
          <div className="mt-2 text-xl font-semibold">{analysisRows.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Credits</div>
          <div className="mt-2 text-xl font-semibold text-emerald-700">{formatMoney(credits)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Debits</div>
          <div className="mt-2 text-xl font-semibold text-rose-700">{formatMoney(debits)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Net Movement</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(netMovement)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Employees</div>
          <div className="mt-2 text-xl font-semibold">{uniqueEmployees}</div>
        </div>
      </div>

      {employeeId ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">Opening Balance</div>
            <div className="mt-2 text-xl font-semibold">{formatMoney(openingBalance)}</div>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">Closing Balance</div>
            <div className="mt-2 text-xl font-semibold">{formatMoney(closingBalance)}</div>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">Filtered Available Delta</div>
            <div className="mt-2 text-xl font-semibold">{formatMoney(closingBalance - openingBalance)}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Source Summary</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Source</th>
                  <th className="py-2">Rows</th>
                  <th className="py-2">Credits</th>
                  <th className="py-2">Debits</th>
                  <th className="py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {sourceSummary.map((row) => (
                  <tr key={row.sourceType} className="border-b">
                    <td className="py-2 font-medium">{row.sourceType}</td>
                    <td className="py-2">{row.count}</td>
                    <td className="py-2">{formatMoney(row.credits)}</td>
                    <td className="py-2">{formatMoney(row.debits)}</td>
                    <td className="py-2">{formatMoney(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sourceSummary.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No source summary available.</div> : null}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Monthly Movement</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Month</th>
                  <th className="py-2">Rows</th>
                  <th className="py-2">Credits</th>
                  <th className="py-2">Debits</th>
                  <th className="py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row) => (
                  <tr key={row.month} className="border-b">
                    <td className="py-2 font-medium">{row.month}</td>
                    <td className="py-2">{row.rows}</td>
                    <td className="py-2">{formatMoney(row.credits)}</td>
                    <td className="py-2">{formatMoney(row.debits)}</td>
                    <td className="py-2">{formatMoney(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {monthlySummary.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No monthly movement found.</div> : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Type</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Balance</th>
                <th className="py-2">Source</th>
                <th className="py-2">Company Account</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Posted By</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.employee?.name || entry.employee?.email || "-"}</td>
                  <td className="py-2">{entry.type}</td>
                  <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                  <td className="py-2">{formatMoney(Number(entry.balance))}</td>
                  <td className="py-2">{entry.sourceType || "-"}</td>
                  <td className="py-2">{entry.companyAccount?.name || "-"}</td>
                  <td className="py-2">{entry.reference || "-"}</td>
                  <td className="py-2">{entry.postedBy?.name || entry.postedBy?.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {ledgers.map((entry) => (
            <div key={entry.id} className="border rounded-lg p-4 space-y-1">
              <div className="font-semibold">
                {entry.employee?.name || entry.employee?.email || "-"}
              </div>
              <div className="text-sm">Date: {new Date(entry.date).toLocaleDateString()}</div>
              <div className="text-sm">Type: {entry.type}</div>
              <div className="text-sm">Amount: {formatMoney(Number(entry.amount))}</div>
              <div className="text-sm">Balance: {formatMoney(Number(entry.balance))}</div>
              <div className="text-sm">Source: {entry.sourceType || "-"}</div>
              <div className="text-sm">Company Account: {entry.companyAccount?.name || "-"}</div>
              <div className="text-sm">Reference: {entry.reference || "-"}</div>
              <div className="text-sm">Posted By: {entry.postedBy?.name || entry.postedBy?.email || "-"}</div>
            </div>
          ))}
        </div>

        {ledgers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No wallet transactions found.</div>
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
