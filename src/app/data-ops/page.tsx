import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { DataOpsJobsPanel } from "@/components/DataOpsJobsPanel";

export default async function DataOpsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Data Ops</h1>
        <p className="mt-2 text-sm text-red-700">Forbidden: audit view permission required.</p>
      </div>
    );
  }

  const canRun =
    (await requirePermission(session.user.id, "accounting.manage")) ||
    (await requirePermission(session.user.id, "reports.export"));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Ops</h1>
        <p className="text-sm text-muted-foreground">
          Run controlled data operations and review audit-backed job history.
        </p>
      </div>
      <DataOpsJobsPanel canRun={canRun} />
    </div>
  );
}

