import { auth } from "@/lib/auth";
import EmployeeAccessManager from "@/components/EmployeeAccessManager";
import OrganizationSettingsManager from "@/components/OrganizationSettingsManager";
import AccessControlCenter from "@/components/AccessControlCenter";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
     return (
        redirect("/login")
        );
  }

  const [canManageEmployees, canManageAccounting, canManageCompanyAccounts] = await Promise.all([
    requirePermission(session.user.id, "employees.view_all"),
    requirePermission(session.user.id, "accounting.manage"),
    requirePermission(session.user.id, "company_accounts.manage"),
  ]);
  const canManage = canManageEmployees || canManageAccounting || canManageCompanyAccounts;
  if (!canManage) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to settings.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 overflow-x-hidden">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Control ERP governance with business terms: role templates, user-level feature toggles, and approval routes by amount.
        </p>
        <div className="mt-4 grid gap-3 rounded-lg border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-900 md:grid-cols-3">
          <div>
            <div className="font-semibold">1. Login Provisioning</div>
            <div className="mt-1 text-sky-800">Create login accounts and assign base role per employee.</div>
          </div>
          <div>
            <div className="font-semibold">2. Feature Access Matrix</div>
            <div className="mt-1 text-sky-800">Turn each feature on/off for templates and individual users.</div>
          </div>
          <div>
            <div className="font-semibold">3. Approval Routes</div>
            <div className="mt-1 text-sky-800">Define who approves which amount range for expense/income/procurement.</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/master-data" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            Open Master Data Center
          </Link>
          <Link href="/expenses" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            Open Expense Management
          </Link>
        </div>
      </div>

      <OrganizationSettingsManager />

      <EmployeeAccessManager />

      <AccessControlCenter />
    </div>
  );
}
