import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import QuerySelect from "@/components/QuerySelect";

export default async function WalletLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; type?: string }>;
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

  const params = await searchParams;
  const search = (params.search || "").trim();
  const type = (params.type || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let baseWhere: Record<string, unknown> = {};
  if (!canViewAll && !canEdit && session.user.email) {
    const employee = await prisma.employee.findUnique({ where: { email: session.user.email } });
    if (employee) {
      baseWhere = { employeeId: employee.id };
    } else {
      baseWhere = { employeeId: "__none__" };
    }
  }

  const where: Record<string, unknown> = { ...baseWhere };
  if (search) {
    where.AND = [
      baseWhere,
      {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { employee: { name: { contains: search, mode: "insensitive" } } },
          { employee: { email: { contains: search, mode: "insensitive" } } },
        ],
      },
    ];
  }
  if (type) {
    where.type = type;
  }

  const [ledgers, total] = await Promise.all([
    prisma.walletLedger.findMany({
      where,
      orderBy: { date: "desc" },
      include: { employee: true },
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
                <th className="py-2">Reference</th>
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
                  <td className="py-2">{entry.reference || "-"}</td>
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
              <div className="text-sm">Reference: {entry.reference || "-"}</div>
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
