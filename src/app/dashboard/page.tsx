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

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Controls</div>
          <div className="mt-3 grid gap-2 text-sm">
            <Link className="underline" href="/approvals">
              Approvals Queue
            </Link>
            <Link className="underline" href="/audit">
              Audit Log
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Reports</div>
          <div className="mt-3 grid gap-2 text-sm">
            <Link className="underline" href="/reports/ap">
              AP Aging
            </Link>
            <Link className="underline" href="/reports/procurement">
              Procurement (Stock-in)
            </Link>
            <Link className="underline" href="/reports">
              All Reports
            </Link>
          </div>
        </div>

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
      </div>
    </div>
  );
}
