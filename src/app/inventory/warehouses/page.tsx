import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import WarehousesManager from "@/components/WarehousesManager";

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "inventory.view");
  const canManage = await requirePermission(session.user.id, "inventory.adjust");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to inventory master data.</p>
      </div>
    );
  }

  const rows = await prisma.warehouse.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <p className="mt-2 text-muted-foreground">Warehouse master for inventory postings and controls.</p>
      </div>
      <WarehousesManager canManage={canManage} rows={rows} />
    </div>
  );
}
