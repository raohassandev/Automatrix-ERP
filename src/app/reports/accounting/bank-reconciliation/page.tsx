import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBookBalance } from "@/lib/bank-reconciliation";
import DateRangePicker from "@/components/DateRangePicker";
import { BankReconciliationManager } from "@/components/BankReconciliationManager";

export default async function BankReconciliationPage({
  searchParams,
}: {
  searchParams: { companyAccountId?: string; asOfDate?: string; statementBalance?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView =
    (await requirePermission(session.user.id, "reports.view_all")) ||
    (await requirePermission(session.user.id, "reports.view_team")) ||
    (await requirePermission(session.user.id, "reports.view_own")) ||
    (await requirePermission(session.user.id, "company_accounts.view"));
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Bank Reconciliation</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const accounts = await prisma.companyAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  const selectedAccountId = (searchParams.companyAccountId || "").trim() || accounts[0]?.id || null;
  const asOf = new Date((searchParams.asOfDate || "").trim() || new Date().toISOString().slice(0, 10));
  asOf.setHours(23, 59, 59, 999);
  const statementBalanceParam = (searchParams.statementBalance || "").trim();
  const statementBalance = statementBalanceParam ? Number(statementBalanceParam) : null;

  const bookBalance = selectedAccountId ? await getBookBalance(selectedAccountId, asOf) : 0;
  const difference =
    statementBalance === null ? null : Number((statementBalance - bookBalance).toFixed(2));

  const snapshots = selectedAccountId
    ? await prisma.bankReconciliationSnapshot.findMany({
        where: { companyAccountId: selectedAccountId },
        orderBy: { asOfDate: "desc" },
        take: 20,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      })
    : [];

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bank Reconciliation</h1>
            <p className="mt-2 text-muted-foreground">
              Compare bank statement against ERP book balance and save reconciliation snapshots.
            </p>
          </div>
          <DateRangePicker />
        </div>
      </div>

      <BankReconciliationManager
        initialData={{
          accounts,
          selectedAccountId,
          asOfDate: asOf.toISOString(),
          bookBalance,
          statementBalance,
          difference,
          snapshots: snapshots.map((row) => ({
            id: row.id,
            asOfDate: row.asOfDate.toISOString(),
            bookBalance: Number(row.bookBalance),
            statementBalance: Number(row.statementBalance),
            difference: Number(row.difference),
            status: row.status,
            notes: row.notes,
            createdBy: row.createdBy,
            createdAt: row.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
