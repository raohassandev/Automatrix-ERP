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

export default async function WalletLedgerPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    page?: string;
    type?: string;
    sourceType?: string;
    from?: string;
    to?: string;
    employeeId?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

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

  const params = searchParams;
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
    ? await prisma.employee.findUnique({ where: { email: session.user.email }, select: { id: true } })
    : null;

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

  const [ledgers, total] = await Promise.all([
    prisma.walletLedger.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        employee: true,
        companyAccount: { select: { id: true, name: true, type: true } },
        postedBy: { select: { id: true, name: true, email: true } },
      },
      skip,
      take,
    }),
    prisma.walletLedger.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Wallet Ledger</h1>
            <p className="mt-2 text-muted-foreground">Employee wallet transactions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee or reference..." />
            </div>
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
