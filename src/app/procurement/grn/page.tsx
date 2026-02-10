import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { GoodsReceiptCreateButton } from "@/components/GoodsReceiptCreateButton";
import { GoodsReceiptActions } from "@/components/GoodsReceiptActions";
import { formatMoney } from "@/lib/format";

export default async function GoodsReceiptPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
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
        <h1 className="text-2xl font-semibold">Goods Receipts</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to procurement.</p>
      </div>
    );
  }

  const params = searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const where = search
    ? {
        OR: [
          { grnNumber: { contains: search, mode: "insensitive" as const } },
          { purchaseOrderId: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [receiptsRaw, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      orderBy: { receivedDate: "desc" },
      include: { items: true, purchaseOrder: true },
      skip,
      take,
    }),
    prisma.goodsReceipt.count({ where }),
  ]);

  const receipts = receiptsRaw.map((receipt) => ({
    ...receipt,
    receivedDate: receipt.receivedDate.toISOString(),
    purchaseOrder: receipt.purchaseOrder
      ? { id: receipt.purchaseOrder.id, poNumber: receipt.purchaseOrder.poNumber }
      : null,
    items: receipt.items.map((item) => ({
      itemName: item.itemName,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      total: Number(item.total),
    })),
  }));

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Goods Receipts</h1>
            <p className="mt-2 text-muted-foreground">Record goods received for purchase orders.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search GRN or PO..." />
            </div>
            {canEdit ? <GoodsReceiptCreateButton /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">GRN #</th>
                <th className="py-2">PO</th>
                <th className="py-2">Received</th>
                <th className="py-2">Status</th>
                <th className="py-2">Total</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => {
                const totalValue = receipt.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
                return (
                  <tr key={receipt.id} className="border-b">
                    <td className="py-2 font-medium">{receipt.grnNumber}</td>
                    <td className="py-2">{receipt.purchaseOrder?.poNumber || "-"}</td>
                    <td className="py-2">
                      {new Date(receipt.receivedDate).toLocaleDateString()}
                    </td>
                    <td className="py-2">{receipt.status}</td>
                    <td className="py-2">{formatMoney(totalValue)}</td>
                    <td className="py-2">
                      {canEdit ? <GoodsReceiptActions receipt={receipt} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {receipts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No goods receipts found.</div>
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
