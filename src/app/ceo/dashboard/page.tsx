import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/format";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default async function CeoDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "dashboard.view_all_metrics");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">CEO Dashboard</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfDay(now);
  const termsDays = 30; // LOCKED (Phase 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const postedBills = await prisma.vendorBill.findMany({
    where: { status: "POSTED" },
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      totalAmount: true,
      vendor: { select: { name: true } },
    },
    orderBy: { billDate: "desc" },
  });

  const billIds = postedBills.map((b) => b.id);
  const paidGroups =
    billIds.length === 0
      ? []
      : await prisma.vendorPaymentAllocation.groupBy({
          by: ["vendorBillId"],
          where: {
            vendorBillId: { in: billIds },
            vendorPayment: { status: "POSTED" },
          },
          _sum: { amount: true },
        });

  const paidMap = new Map(paidGroups.map((g) => [g.vendorBillId, Number(g._sum.amount || 0)]));

  const apRows = postedBills.map((bill) => {
    const total = Number(bill.totalAmount);
    const paid = paidMap.get(bill.id) || 0;
    const outstanding = Math.max(0, total - paid);
    const due = bill.dueDate
      ? new Date(bill.dueDate)
      : new Date(bill.billDate.getTime() + termsDays * 24 * 60 * 60 * 1000);
    const overdueDays =
      outstanding > 0 && due < today ? Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)) : 0;
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      vendorName: bill.vendor.name,
      due,
      total,
      paid,
      outstanding,
      overdueDays,
    };
  });

  const apOutstanding = apRows.reduce((sum, r) => sum + r.outstanding, 0);
  const apOverdueCount = apRows.filter((r) => r.overdueDays > 0 && r.outstanding > 0).length;
  const topOverdue = apRows
    .filter((r) => r.overdueDays > 0 && r.outstanding > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 10);

  const paymentGroups = await prisma.vendorPayment.groupBy({
    by: ["companyAccountId"],
    where: { status: "POSTED", paymentDate: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  });
  const accountIds = paymentGroups.map((g) => g.companyAccountId);
  const accounts = accountIds.length
    ? await prisma.companyAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, name: true } })
    : [];
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const paymentsByAccount = paymentGroups
    .map((g) => ({
      companyAccountId: g.companyAccountId,
      accountName: accountMap.get(g.companyAccountId) || "Unknown",
      amount: Number(g._sum.amount || 0),
    }))
    .sort((a, b) => b.amount - a.amount);

  const purchasesBilledThisMonth = await prisma.vendorBill.aggregate({
    where: { status: "POSTED", billDate: { gte: monthStart, lte: monthEnd } },
    _sum: { totalAmount: true },
  });

  const inventoryWithThreshold = await prisma.inventoryItem.findMany({
    where: { minStock: { gt: 0 } },
    select: { id: true, name: true, quantity: true, minStock: true, unit: true },
    orderBy: { name: "asc" },
  });
  const lowStockAll = inventoryWithThreshold.filter(
    (it) => Number(it.quantity) <= Number(it.minStock)
  );
  const inventoryLowCount = lowStockAll.length;
  const inventoryLow = lowStockAll.slice(0, 10);

  const grnActivity = await prisma.inventoryLedger.aggregate({
    where: { sourceType: "GRN", date: { gte: monthStart, lte: monthEnd } },
    _sum: { quantity: true, total: true },
  });

  const [
    pendingExpenses,
    pendingIncome,
    pendingPos,
    pendingGrns,
    pendingBills,
    pendingPayments,
  ] = await Promise.all([
    prisma.expense.count({ where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } } }),
    prisma.income.count({ where: { status: "PENDING" } }),
    prisma.purchaseOrder.count({ where: { status: "SUBMITTED" } }),
    prisma.goodsReceipt.count({ where: { status: "SUBMITTED" } }),
    prisma.vendorBill.count({ where: { status: "SUBMITTED" } }),
    prisma.vendorPayment.count({ where: { status: "SUBMITTED" } }),
  ]);

  const exceptions = await prisma.auditLog.findMany({
    where: { action: { startsWith: "BLOCK_" } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">CEO Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Phase 1 truthful KPIs driven by procurement + inventory + allocations (no GL).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">AP outstanding</div>
          <div className="mt-2 text-2xl font-bold">{formatMoney(apOutstanding)}</div>
          <div className="mt-1 text-sm text-muted-foreground">Overdue bills: {apOverdueCount}</div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/reports/ap">
              View AP aging
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Purchases billed (this month)</div>
          <div className="mt-2 text-2xl font-bold">
            {formatMoney(Number(purchasesBilledThisMonth._sum.totalAmount || 0))}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/procurement/vendor-bills">
              Vendor bills
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">GRN stock-in (this month)</div>
          <div className="mt-2 text-2xl font-bold">
            {Number(grnActivity._sum.quantity || 0).toLocaleString()} units
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Value: {formatMoney(Number(grnActivity._sum.total || 0))}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/procurement/grn">
              Goods receipts (GRN)
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Payments (this month) by account</div>
          <div className="mt-2 space-y-1 text-sm">
            {paymentsByAccount.length === 0 ? (
              <div className="text-muted-foreground">No posted vendor payments this month.</div>
            ) : (
              paymentsByAccount.slice(0, 5).map((row) => (
                <div key={row.companyAccountId} className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.accountName}</span>
                  <span className="font-medium">{formatMoney(row.amount)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/procurement/vendor-payments">
              Vendor payments
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Low stock items</div>
          <div className="mt-2 text-2xl font-bold">{inventoryLowCount}</div>
          <div className="mt-2 space-y-1 text-sm">
            {inventoryLow.length === 0 ? (
              <div className="text-muted-foreground">No low stock items.</div>
            ) : (
              inventoryLow.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{it.name}</span>
                  <span className="text-muted-foreground">
                    {Number(it.quantity).toLocaleString()} / {Number(it.minStock).toLocaleString()} {it.unit}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/reports/inventory">
              Inventory report
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Approval queue (pending)</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span>Expenses</span>
              <span className="font-medium">{pendingExpenses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Income</span>
              <span className="font-medium">{pendingIncome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>PO (submitted)</span>
              <span className="font-medium">{pendingPos}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>GRN (submitted)</span>
              <span className="font-medium">{pendingGrns}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Vendor bills (submitted)</span>
              <span className="font-medium">{pendingBills}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Vendor payments (submitted)</span>
              <span className="font-medium">{pendingPayments}</span>
            </div>
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/approvals">
              Go to approvals
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Top overdue bills</div>
              <div className="text-sm text-muted-foreground">Outstanding posted bills sorted by overdue days.</div>
            </div>
            <Link className="text-sm underline" href="/reports/ap">
              AP report
            </Link>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {topOverdue.length === 0 ? (
              <div className="text-muted-foreground">No overdue bills.</div>
            ) : (
              topOverdue.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.billNumber}</div>
                    <div className="truncate text-xs text-muted-foreground">{row.vendorName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatMoney(row.outstanding)}</div>
                    <div className="text-xs text-muted-foreground">{row.overdueDays}d overdue</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Exceptions (blocked actions)</div>
              <div className="text-sm text-muted-foreground">
                Recent hard blocks enforced by API rules (Phase 1 guardrails).
              </div>
            </div>
            <Link className="text-sm underline" href="/audit">
              Audit log
            </Link>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {exceptions.length === 0 ? (
              <div className="text-muted-foreground">No blocked actions recorded.</div>
            ) : (
              exceptions.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{row.action}</div>
                    <div className="truncate text-xs text-muted-foreground">{row.reason || row.entity}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
