import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import GlAccountsManager from "@/components/GlAccountsManager";

export default async function GlAccountsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "accounting.view");
  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to accounting.</p>
      </div>
    );
  }

  const accounts = await prisma.glAccount.findMany({
    orderBy: [{ code: "asc" }],
    include: { parent: { select: { id: true, code: true, name: true } } },
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
        <p className="mt-2 text-muted-foreground">Create and control GL accounts used by double-entry postings.</p>
      </div>
      <GlAccountsManager initialAccounts={accounts} canManage={canManage} />
    </div>
  );
}
