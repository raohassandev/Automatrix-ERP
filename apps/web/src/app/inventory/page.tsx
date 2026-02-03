import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { MobileCard } from "@/components/MobileCard";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">Please sign in.</p>
      </div>
    );
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to inventory.</p>
      </div>
    );
  }

  let items = [];
  try {
    items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">Error loading inventory data. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">Inventory item list.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Item</th>
                <th className="py-2">Category</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Unit Cost</th>
                <th className="py-2">Total</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.category}</td>
                  <td className="py-2">{Number(item.quantity)}</td>
                  <td className="py-2">{formatMoney(Number(item.unitCost))}</td>
                  <td className="py-2">{formatMoney(Number(item.totalValue))}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <QuickEditButton
                        url={`/api/inventory/${item.id}`}
                        fields={{ unitCost: "Unit Cost", minStock: "Min Stock", reorderQty: "Reorder Qty" }}
                      />
                      <DeleteButton url={`/api/inventory/${item.id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-4">
          {items.map((item) => (
            <MobileCard
              key={item.id}
              title={item.name}
              subtitle={item.category}
              fields={[
                { label: "Quantity", value: Number(item.quantity) },
                { label: "Unit Cost", value: formatMoney(Number(item.unitCost)) },
                { label: "Total Value", value: formatMoney(Number(item.totalValue)) },
              ]}
              actions={
                <>
                  <QuickEditButton
                    url={`/api/inventory/${item.id}`}
                    fields={{ unitCost: "Unit Cost", minStock: "Min Stock", reorderQty: "Reorder Qty" }}
                  />
                  <DeleteButton url={`/api/inventory/${item.id}`} />
                </>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
