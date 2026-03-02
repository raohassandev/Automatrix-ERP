import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { canAccessAccountingReports } from "@/lib/accounting-report-access";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canViewAccountingReports = await canAccessAccountingReports(session.user.id);
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  // Phase 1 single-spine (truth sources):
  // - AP: posted vendor bills - posted payment allocations (no full GL)
  // - Inventory: item master (avg cost) / stock ledger
  const [postedBillsSum, postedAllocationsSum, inventoryValueSum, inventoryItems, pendingCounts] =
    await Promise.all([
      prisma.vendorBill.aggregate({ where: { status: "POSTED" }, _sum: { totalAmount: true } }),
      prisma.vendorPaymentAllocation.aggregate({
        where: {
          vendorPayment: { status: "POSTED" },
          vendorBill: { status: "POSTED" },
        },
        _sum: { amount: true },
      }),
      prisma.inventoryItem.aggregate({ _sum: { totalValue: true } }),
      prisma.inventoryItem.findMany({
        where: { minStock: { gt: 0 } },
        select: { quantity: true, minStock: true },
      }),
      Promise.all([
        prisma.purchaseOrder.count({ where: { status: "SUBMITTED" } }),
        prisma.goodsReceipt.count({ where: { status: "SUBMITTED" } }),
        prisma.vendorBill.count({ where: { status: "SUBMITTED" } }),
        prisma.vendorPayment.count({ where: { status: "SUBMITTED" } }),
      ]),
    ]);

  const billsTotal = Number(postedBillsSum._sum.totalAmount || 0);
  const paidTotal = Number(postedAllocationsSum._sum.amount || 0);
  const apOutstanding = Math.max(0, billsTotal - paidTotal);

  const inventoryValue = Number(inventoryValueSum._sum.totalValue || 0);
  const inventoryLowStockItems = inventoryItems.filter(
    (i) => Number(i.quantity) <= Number(i.minStock),
  ).length;

  const [pendingPos, pendingGrns, pendingBills, pendingPayments] = pendingCounts;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-muted-foreground">
          Phase 1 truthful reports sourced from the single spine (Procurement + Inventory + AP allocations).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">AP outstanding</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(apOutstanding)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Inventory on-hand value</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(inventoryValue)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Low stock alerts</div>
          <div className="mt-2 text-xl font-semibold">{inventoryLowStockItems}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Approvals queue (submitted)</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span>PO</span>
              <span className="font-medium">{pendingPos}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>GRN</span>
              <span className="font-medium">{pendingGrns}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bills</span>
              <span className="font-medium">{pendingBills}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Payments</span>
              <span className="font-medium">{pendingPayments}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canViewAccountingReports ? (
          <>
            <a href="/reports/accounting/trial-balance" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Accounting</div>
              <div className="mt-2 text-lg font-semibold">Trial Balance (double-entry)</div>
            </a>
            <a href="/reports/accounting/cash-position" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Treasury</div>
              <div className="mt-2 text-lg font-semibold">Cash Position by Account</div>
            </a>
            <a href="/reports/accounting/cash-forecast" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Treasury</div>
              <div className="mt-2 text-lg font-semibold">14/30 Day Cash Forecast</div>
            </a>
            <a href="/reports/accounting/bank-reconciliation" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Treasury Control</div>
              <div className="mt-2 text-lg font-semibold">Bank Reconciliation</div>
            </a>
            <a href="/reports/accounting/ar-aging" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Receivables</div>
              <div className="mt-2 text-lg font-semibold">AR Aging</div>
            </a>
            <a href="/reports/accounting/o2c-reconciliation" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Receivables Control</div>
              <div className="mt-2 text-lg font-semibold">O2C Reconciliation</div>
            </a>
            <a href="/reports/accounting/profit-loss" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Accounting</div>
              <div className="mt-2 text-lg font-semibold">Profit &amp; Loss</div>
            </a>
            <a href="/reports/accounting/balance-sheet" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
              <div className="text-sm text-muted-foreground">Accounting</div>
              <div className="mt-2 text-lg font-semibold">Balance Sheet</div>
            </a>
          </>
        ) : null}
        <a href="/reports/ap" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
          <div className="text-sm text-muted-foreground">AP Aging</div>
          <div className="mt-2 text-lg font-semibold">Outstanding vendor bills (allocations-only)</div>
        </a>
        <a href="/reports/inventory" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
          <div className="text-sm text-muted-foreground">Inventory Report</div>
          <div className="mt-2 text-lg font-semibold">On-hand, valuation, low stock</div>
        </a>
        <a href="/reports/procurement" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
          <div className="text-sm text-muted-foreground">Procurement (Stock-in)</div>
          <div className="mt-2 text-lg font-semibold">GRN postings into stock ledger</div>
        </a>
        <a href="/reports/exceptions" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
          <div className="text-sm text-muted-foreground">Controls</div>
          <div className="mt-2 text-lg font-semibold">Exceptions Log (blocked actions)</div>
        </a>
        <a href="/reports/controls" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
          <div className="text-sm text-muted-foreground">Controls</div>
          <div className="mt-2 text-lg font-semibold">Controls KPI Snapshot</div>
        </a>
        <a href="/audit" className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent">
          <div className="text-sm text-muted-foreground">Audit Log</div>
          <div className="mt-2 text-lg font-semibold">Traceability + exceptions</div>
        </a>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-sm font-medium text-muted-foreground">Legacy / Non-spine (not Phase 1 truth sources)</div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <a className="underline" href="/reports/expenses">
            Expense Report (non-stock)
          </a>
          <a className="underline" href="/reports/employee-expenses">
            Employee Expense Summary
          </a>
          <a className="underline" href="/reports/wallets">
            Wallet Summary
          </a>
          <a className="underline" href="/reports/projects">
            Project Expense Report (legacy)
          </a>
        </div>
      </div>
    </div>
  );
}
