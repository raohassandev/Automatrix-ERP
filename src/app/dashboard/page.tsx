import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canViewCeo = await requirePermission(session.user.id, "dashboard.view_all_metrics");
  const canManageCompanyAccounts = await requirePermission(session.user.id, "company_accounts.manage");
  const canViewProcurement = await requirePermission(session.user.id, "procurement.view_all");
  const canEditProcurement = await requirePermission(session.user.id, "procurement.edit");
  const canViewInventory = await requirePermission(session.user.id, "inventory.view");
  const canViewApprovals = await requirePermission(session.user.id, "approvals.view_pending");
  const canViewAllApprovals = await requirePermission(session.user.id, "approvals.view_all");
  const canViewAudit = await requirePermission(session.user.id, "audit.view");
  const canViewReportsOwn = await requirePermission(session.user.id, "reports.view_own");
  const canViewReportsTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewReportsAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewAccounting = await requirePermission(session.user.id, "accounting.view");
  const canManageAccounting = await requirePermission(session.user.id, "accounting.manage");
  const canViewOwnEmployees = await requirePermission(session.user.id, "employees.view_own");
  const canViewAllEmployees = await requirePermission(session.user.id, "employees.view_all");
  const canSubmitExpense = await requirePermission(session.user.id, "expenses.submit");

  const canViewReports = canViewReportsOwn || canViewReportsTeam || canViewReportsAll;
  const canViewControls = canViewApprovals || canViewAllApprovals || canViewAudit;
  const canViewWorkspace = canViewOwnEmployees || canViewAllEmployees || canSubmitExpense;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Phase 1 is running in single-spine mode (Procurement + Inventory + Approvals/Audit + truthful reports).
        </p>
        {canViewCeo ? (
          <div className="mt-3">
            <Link className="text-sm underline" href="/ceo/dashboard">
              Open CEO dashboard (truthful KPIs)
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {canViewProcurement || canEditProcurement ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Procurement</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline" href="/procurement/purchase-orders">
                Purchase Orders
              </Link>
              <Link className="underline" href="/procurement/grn">
                Goods Receipts (GRN)
              </Link>
              <Link className="underline" href="/procurement/vendor-bills">
                Vendor Bills
              </Link>
              {canManageCompanyAccounts ? (
                <Link className="underline" href="/procurement/vendor-payments">
                  Vendor Payments
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewInventory ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Inventory</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline" href="/inventory">
                Items
              </Link>
              <Link className="underline" href="/inventory/ledger">
                Stock Ledger
              </Link>
              <Link className="underline" href="/reports/inventory">
                Inventory Report
              </Link>
            </div>
          </div>
        ) : null}

        {canViewControls ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Controls</div>
            <div className="mt-3 grid gap-2 text-sm">
              {canViewApprovals || canViewAllApprovals ? (
                <Link className="underline" href="/approvals">
                  Approvals Queue
                </Link>
              ) : null}
              {canViewAudit ? (
                <Link className="underline" href="/audit">
                  Audit Log
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewReports ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Reports</div>
            <div className="mt-3 grid gap-2 text-sm">
              {canViewAccounting || canManageAccounting || canManageCompanyAccounts ? (
                <Link className="underline" href="/reports/ap">
                  AP Aging
                </Link>
              ) : null}
              {canViewProcurement || canViewReportsAll || canViewReportsTeam ? (
                <Link className="underline" href="/reports/procurement">
                  Procurement (Stock-in)
                </Link>
              ) : null}
              <Link className="underline" href="/reports">
                All Reports
              </Link>
            </div>
          </div>
        ) : null}

        {canViewWorkspace ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">My Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline" href="/me">
                My Dashboard
              </Link>
              <Link className="underline" href="/wallets">
                Wallets
              </Link>
              <Link className="underline" href="/expenses">
                Expenses
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
