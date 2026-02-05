import { auth } from "@/lib/auth";
import RoleAssignForm from "@/components/RoleAssignForm";
import ApprovalPolicyManager from "@/components/ApprovalPolicyManager";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

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
        <p className="mt-2 text-muted-foreground">Role assignment and admin tools.</p>
      </div>

      <RoleAssignForm />

      <ApprovalPolicyManager />
    </div>
  );
}
