import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";

function withinDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export default async function ControlsReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Controls Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from30 = withinDays(30);
  const [pendingExpense, pendingIncome, submittedProcurement, blockedEvents30, authDenied30, authSuccess30] =
    await Promise.all([
      prisma.expense.count({ where: { status: { startsWith: "PENDING" } } }),
      prisma.income.count({ where: { status: "PENDING" } }),
      Promise.all([
        prisma.purchaseOrder.count({ where: { status: "SUBMITTED" } }),
        prisma.goodsReceipt.count({ where: { status: "SUBMITTED" } }),
        prisma.vendorBill.count({ where: { status: "SUBMITTED" } }),
        prisma.vendorPayment.count({ where: { status: "SUBMITTED" } }),
      ]),
      prisma.auditLog.count({
        where: {
          action: { startsWith: "BLOCK_" },
          createdAt: { gte: from30 },
        },
      }),
      prisma.auditLog.count({
        where: { action: "AUTH_SIGNIN_DENIED", createdAt: { gte: from30 } },
      }),
      prisma.auditLog.count({
        where: { action: "AUTH_SIGNIN_SUCCESS", createdAt: { gte: from30 } },
      }),
    ]);

  const [poSubmitted, grnSubmitted, billSubmitted, paymentSubmitted] = submittedProcurement;
  const totalQueue = pendingExpense + pendingIncome + poSubmitted + grnSubmitted + billSubmitted + paymentSubmitted;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Controls Report</h1>
        <p className="mt-2 text-muted-foreground">
          Approval queue health, blocked control events, and security sign-in signals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-sm text-amber-700">Total Pending Queue</div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">{totalQueue}</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
          <div className="text-sm text-rose-700">Blocked Events (30d)</div>
          <div className="mt-2 text-2xl font-semibold text-rose-900">{blockedEvents30}</div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
          <div className="text-sm text-sky-700">Denied Sign-ins (30d)</div>
          <div className="mt-2 text-2xl font-semibold text-sky-900">{authDenied30}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Queue Breakdown</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md border p-3">Expenses pending: <span className="font-semibold">{pendingExpense}</span></div>
          <div className="rounded-md border p-3">Income pending: <span className="font-semibold">{pendingIncome}</span></div>
          <div className="rounded-md border p-3">PO submitted: <span className="font-semibold">{poSubmitted}</span></div>
          <div className="rounded-md border p-3">GRN submitted: <span className="font-semibold">{grnSubmitted}</span></div>
          <div className="rounded-md border p-3">Vendor bills submitted: <span className="font-semibold">{billSubmitted}</span></div>
          <div className="rounded-md border p-3">Vendor payments submitted: <span className="font-semibold">{paymentSubmitted}</span></div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm text-sm">
        Successful sign-ins in last 30 days: <span className="font-semibold">{authSuccess30}</span>
      </div>
    </div>
  );
}
