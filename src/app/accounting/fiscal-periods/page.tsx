import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import FiscalPeriodsManager from "@/components/FiscalPeriodsManager";

export default async function FiscalPeriodsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "accounting.view");
  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Fiscal Periods</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to accounting.</p>
      </div>
    );
  }

  const periods = await prisma.fiscalPeriod.findMany({
    orderBy: [{ startDate: "desc" }],
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Fiscal Periods</h1>
        <p className="mt-2 text-muted-foreground">Close and reopen periods to control posting windows.</p>
      </div>
      <FiscalPeriodsManager periods={periods} canManage={canManage} />
    </div>
  );
}
