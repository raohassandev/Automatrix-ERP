import { auth } from "@/lib/auth";
import RoleAssignForm from "@/components/RoleAssignForm";
import ApprovalPolicyManager from "@/components/ApprovalPolicyManager";
import EmployeeAccessManager from "@/components/EmployeeAccessManager";
import OrganizationSettingsManager from "@/components/OrganizationSettingsManager";
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

  const canManage = await requirePermission(session.user.id, "employees.view_all");
  if (!canManage) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to settings.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Control who can access what in the ERP. Use the steps below in order for clean access governance.
        </p>
        <div className="mt-4 grid gap-3 rounded-lg border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-900 md:grid-cols-3">
          <div>
            <div className="font-semibold">1. Organization Defaults</div>
            <div className="mt-1 text-sky-800">Set policy defaults used by expenses and approval flow.</div>
          </div>
          <div>
            <div className="font-semibold">2. Employee Access</div>
            <div className="mt-1 text-sky-800">Create login + assign role to employee accounts.</div>
          </div>
          <div>
            <div className="font-semibold">3. Approval and Role Mapping</div>
            <div className="mt-1 text-sky-800">Tune approvers and role assignment for operational control.</div>
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

      <ApprovalPolicyManager />

      <RoleAssignForm />
    </div>
  );
}
