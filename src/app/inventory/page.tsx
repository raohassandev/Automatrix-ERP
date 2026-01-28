import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import InventoryForm from "@/components/InventoryForm";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-gray-600">Please sign in.</p>
      </div>
    );
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-gray-600">You do not have access to inventory.</p>
      </div>
    );
  }

  const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-gray-600">Inventory item list.</p>
      </div>

      <InventoryForm />

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
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
      </div>
    </div>
  );
}
