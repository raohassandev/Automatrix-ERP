import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { getControlRegistersSummary } from "@/lib/control-registers";

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
  const inventoryQualityRows = await prisma.inventoryItem.findMany({
    select: { id: true, name: true, sku: true, canonicalName: true, lastUpdated: true },
    orderBy: { lastUpdated: "desc" },
  });
  const lowStockAll = inventoryWithThreshold.filter(
    (it) => Number(it.quantity) <= Number(it.minStock)
  );
  const inventoryLowCount = lowStockAll.length;
  const inventoryLow = lowStockAll.slice(0, 10);
  const inventoryMissingSkuCount = inventoryQualityRows.filter((row) => !row.sku || !row.sku.trim()).length;
  const nameRiskBuckets = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of inventoryQualityRows) {
    const key = row.canonicalName.slice(0, 8);
    if (!key || key.length < 4) continue;
    const existing = nameRiskBuckets.get(key) || [];
    existing.push({ id: row.id, name: row.name });
    nameRiskBuckets.set(key, existing);
  }
  const nameRiskGroups = Array.from(nameRiskBuckets.values())
    .filter((rows) => rows.length > 1)
    .map((rows) => rows.slice(0, 3).map((row) => row.name).join(" / "))
    .slice(0, 3);

  const grnActivity = await prisma.inventoryLedger.aggregate({
    where: { sourceType: "GRN", date: { gte: monthStart, lte: monthEnd } },
    _sum: { quantity: true, total: true },
  });

  const [
    pendingPos,
    pendingGrns,
    pendingBills,
    pendingPayments,
  ] = await Promise.all([
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
  const inventoryDuplicateBlocksMonth = await prisma.auditLog.count({
    where: {
      action: { in: ["BLOCK_INVENTORY_DUPLICATE_NAME", "BLOCK_INVENTORY_DUPLICATE_SKU"] },
      createdAt: { gte: monthStart, lte: monthEnd },
    },
  });
  const controlSummary = await getControlRegistersSummary();

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-sky-500/10 p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">CEO Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Phase 1 truthful KPIs driven by procurement + inventory + allocations (no GL).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-rose-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-rose-500/10">
          <div className="text-sm font-medium text-rose-700 dark:text-rose-300">AP outstanding</div>
          <div className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-100">{formatMoney(apOutstanding)}</div>
          <div className="mt-1 text-sm text-rose-700/80 dark:text-rose-300/80">Overdue bills: {apOverdueCount}</div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/reports/ap">
              View AP aging
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-emerald-500/10">
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Purchases billed (this month)</div>
          <div className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatMoney(Number(purchasesBilledThisMonth._sum.totalAmount || 0))}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/procurement/vendor-bills">
              Vendor bills
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-sky-500/10">
          <div className="text-sm font-medium text-sky-700 dark:text-sky-300">GRN stock-in (this month)</div>
          <div className="mt-2 text-2xl font-bold text-sky-900 dark:text-sky-100">
            {Number(grnActivity._sum.quantity || 0).toLocaleString()} units
          </div>
          <div className="mt-1 text-sm text-sky-700/80 dark:text-sky-300/80">
            Value: {formatMoney(Number(grnActivity._sum.total || 0))}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/procurement/grn">
              Goods receipts (GRN)
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-indigo-500/10">
          <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Payments (this month) by account</div>
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

        <div className="rounded-xl border border-amber-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-amber-500/10">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">Low stock items</div>
          <div className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-100">{inventoryLowCount}</div>
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

        <div className="rounded-xl border border-violet-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-violet-500/10">
          <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Inventory data quality</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Items missing SKU</span>
              <span className="font-medium">{inventoryMissingSkuCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Duplicate attempts blocked (month)</span>
              <span className="font-medium">{inventoryDuplicateBlocksMonth}</span>
            </div>
            <div className="pt-1 text-xs text-muted-foreground">
              Similar-name risk clusters: {nameRiskGroups.length || 0}
            </div>
            {nameRiskGroups.slice(0, 2).map((group) => (
              <div key={group} className="truncate text-xs text-muted-foreground">
                {group}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/inventory">
              Review inventory master
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-cyan-500/10">
          <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Approval queue (pending)</div>
          <div className="mt-2 space-y-1 text-sm">
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

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Control Register Snapshot</div>
            <div className="text-sm text-muted-foreground">
              Cross-module truth snapshot for payroll, variable pay, settlements, projects, and AP.
            </div>
          </div>
          <Link className="text-sm underline" href="/reports/controls">
            Controls report
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-sm">
            <div className="text-sky-700 dark:text-sky-300">Payroll net</div>
            <div className="mt-1 font-semibold">{formatMoney(controlSummary.payroll.totalNetPay)}</div>
            <div className="text-xs text-muted-foreground">
              {controlSummary.payroll.count} entries • Overdue {controlSummary.payroll.totalOverdue}
            </div>
          </div>
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3 text-sm">
            <div className="text-indigo-700 dark:text-indigo-300">Variable pay unsettled</div>
            <div className="mt-1 font-semibold">{formatMoney(controlSummary.variablePay.unsettledAmount)}</div>
            <div className="text-xs text-muted-foreground">{controlSummary.variablePay.count} rows tracked</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
            <div className="text-emerald-700 dark:text-emerald-300">Employee net payable</div>
            <div className="mt-1 font-semibold">{formatMoney(controlSummary.settlements.netCompanyPayable)}</div>
            <div className="text-xs text-muted-foreground">
              Reimburse due: {formatMoney(controlSummary.settlements.reimbursementDue)}
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
            <div className="text-amber-700 dark:text-amber-300">Project pending recovery</div>
            <div className="mt-1 font-semibold">{formatMoney(controlSummary.projects.pendingRecovery)}</div>
            <div className="text-xs text-muted-foreground">{controlSummary.projects.count} projects in register</div>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm">
            <div className="text-rose-700 dark:text-rose-300">AP outstanding</div>
            <div className="mt-1 font-semibold">{formatMoney(controlSummary.procurement.outstanding)}</div>
            <div className="text-xs text-muted-foreground">
              {controlSummary.procurement.rows} vendor rows • Blocked {controlSummary.procurement.blocked}
            </div>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-sm">
            <div className="text-violet-700 dark:text-violet-300">Tasks & approvals overdue</div>
            <div className="mt-1 font-semibold">{controlSummary.taskApprovals.overdue}</div>
            <div className="text-xs text-muted-foreground">{controlSummary.taskApprovals.items} tracked items</div>
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
