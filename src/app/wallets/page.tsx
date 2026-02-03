import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";

export default async function WalletLedgerPage() {
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

  let where = {};
  if (!canViewAll && !canEdit && session.user.email) {
    const employee = await prisma.employee.findUnique({ where: { email: session.user.email } });
    if (employee) {
      where = { employeeId: employee.id };
    } else {
      where = { employeeId: "__none__" };
    }
  }

  const ledgers = await prisma.walletLedger.findMany({
    where,
    orderBy: { date: "desc" },
    include: { employee: true },
    take: 200,
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Wallet Ledger</h1>
        <p className="mt-2 text-muted-foreground">Employee wallet transactions.</p>
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
      </div>
    </div>
  );
}
