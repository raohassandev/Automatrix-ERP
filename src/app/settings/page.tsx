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
        <p className="mt-2 text-muted-foreground">Organization defaults, role assignment, and admin controls.</p>
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

      <RoleAssignForm />

      <ApprovalPolicyManager />

      <EmployeeAccessManager />
    </div>
  );
}
