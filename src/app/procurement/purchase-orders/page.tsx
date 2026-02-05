import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { PurchaseOrderCreateButton } from "@/components/PurchaseOrderCreateButton";
import { PurchaseOrderActions } from "@/components/PurchaseOrderActions";
import { formatMoney } from "@/lib/format";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to procurement.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const where = search
    ? {
        OR: [
          { poNumber: { contains: search, mode: "insensitive" } },
          { vendorName: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [ordersRaw, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { orderDate: "desc" },
      include: { items: true },
      skip,
      take,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const orders = ordersRaw.map((order) => ({
    ...order,
    orderDate: order.orderDate.toISOString(),
    expectedDate: order.expectedDate ? order.expectedDate.toISOString() : null,
    totalAmount: Number(order.totalAmount),
    vendorId: order.vendorId,
    items: order.items.map((item) => ({
      itemName: item.itemName,
      unit: item.unit,
      quantity: Number(item.quantity),
      receivedQty: Number(item.receivedQty || 0),
      unitCost: Number(item.unitCost),
      project: item.project,
    })),
  }));

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Purchase Orders</h1>
            <p className="mt-2 text-muted-foreground">Track vendor orders and expected delivery.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search PO or vendor..." />
            </div>
            {canEdit ? <PurchaseOrderCreateButton /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">PO #</th>
                <th className="py-2">Vendor</th>
                <th className="py-2">Order Date</th>
                <th className="py-2">Received</th>
                <th className="py-2">Status</th>
                <th className="py-2">Total</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b">
                  <td className="py-2 font-medium">{order.poNumber}</td>
                  <td className="py-2">{order.vendorName}</td>
                  <td className="py-2">{new Date(order.orderDate).toLocaleDateString()}</td>
                  <td className="py-2">
                    {order.items.reduce((sum, item) => sum + Number(item.receivedQty || 0), 0)} /
                    {order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                  </td>
                  <td className="py-2">{order.status}</td>
                  <td className="py-2">{formatMoney(order.totalAmount)}</td>
                  <td className="py-2">
                    {canEdit ? <PurchaseOrderActions purchaseOrder={order} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No purchase orders found.</div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
