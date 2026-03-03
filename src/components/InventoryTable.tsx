"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { DeleteButton } from "@/components/TableActions";
import { MobileCard } from "@/components/MobileCard";
import { InventoryLedgerDialog } from "@/components/InventoryLedgerDialog";
import { Button } from "@/components/ui/button";
import { InventoryFormDialog } from "@/components/InventoryFormDialog";
import Link from "next/link";

interface InventoryItemRow {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  quantity: number | string;
  unit: string;
  unitCost: number | string | null;
  lastPurchasePrice?: number | string | null;
  sellingPrice: number | string | null;
  totalValue: number | string | null;
  minStock?: number | string | null;
  reorderQty?: number | string | null;
}

export function InventoryTable({
  items,
  canViewCost,
  canViewSelling,
  canAdjust,
  canRequest,
}: {
  items: InventoryItemRow[];
  canViewCost: boolean;
  canViewSelling: boolean;
  canAdjust: boolean;
  canRequest: boolean;
}) {
  const [ledgerDialog, setLedgerDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
    defaultType?: string;
  }>({ open: false, itemId: "", itemName: "" });
  const [editItem, setEditItem] = useState<InventoryItemRow | null>(null);
  const canMoveStock = canAdjust;
  const canAllocateProject = canAdjust || canRequest;
  const canEditDelete = canAdjust;
  const showActionsColumn = canMoveStock || canAllocateProject || canEditDelete;
  const getStockTone = (item: InventoryItemRow) => {
    const qty = Number(item.quantity || 0);
    const minStock = Number(item.minStock || 0);
    if (minStock > 0 && qty <= minStock) {
      return {
        text: "Low",
        className: "border-rose-300 bg-rose-50 text-rose-700",
      };
    }
    const reorderQty = Number(item.reorderQty || 0);
    if (reorderQty > 0 && qty <= reorderQty) {
      return {
        text: "Reorder",
        className: "border-amber-300 bg-amber-50 text-amber-700",
      };
    }
    return {
      text: "Healthy",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Item</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Category</th>
              <th className="py-2">Qty</th>
              {canViewCost ? <th className="py-2">Avg Cost</th> : null}
              {canViewCost ? <th className="py-2">Last Purchase</th> : null}
              {canViewSelling ? <th className="py-2">Selling Price</th> : null}
              <th className="py-2">Stock Health</th>
              {canViewCost ? <th className="py-2">Total</th> : null}
              {showActionsColumn ? <th className="py-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const tone = getStockTone(item);
              return (
              <tr key={item.id} className="border-b">
                <td className="py-2">
                  <Link className="underline underline-offset-2" href={`/inventory/items/${item.id}`}>
                    {item.name}
                  </Link>
                </td>
                <td className="py-2">{item.sku || "-"}</td>
                <td className="py-2">{item.category}</td>
                <td className="py-2 font-medium">{Number(item.quantity)}</td>
                {canViewCost ? (
                  <td className="py-2">
                    {item.unitCost === null ? "-" : formatMoney(Number(item.unitCost))}
                  </td>
                ) : null}
                {canViewCost ? (
                  <td className="py-2">
                    {item.lastPurchasePrice === null || item.lastPurchasePrice === undefined
                      ? "-"
                      : formatMoney(Number(item.lastPurchasePrice))}
                  </td>
                ) : null}
                {canViewSelling ? (
                  <td className="py-2">
                    {item.sellingPrice === null ? "-" : formatMoney(Number(item.sellingPrice))}
                  </td>
                ) : null}
                <td className="py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tone.className}`}>
                    {tone.text}
                  </span>
                </td>
                {canViewCost ? (
                  <td className="py-2">
                    {item.totalValue === null ? "-" : formatMoney(Number(item.totalValue))}
                  </td>
                ) : null}
                {showActionsColumn ? (
                  <td className="py-2">
                    <div className="flex gap-2">
                      {canMoveStock ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setLedgerDialog({ open: true, itemId: item.id, itemName: item.name, defaultType: "ADJUSTMENT" })
                          }
                        >
                          Stock In/Out
                        </Button>
                      ) : null}
                      {canAllocateProject ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setLedgerDialog({
                              open: true,
                              itemId: item.id,
                              itemName: item.name,
                              defaultType: "PROJECT_ALLOCATION",
                            })
                          }
                        >
                          Allocate to Project
                        </Button>
                      ) : null}
                      {canEditDelete ? (
                        <Button size="sm" variant="outline" onClick={() => setEditItem(item)}>
                          Edit
                        </Button>
                      ) : null}
                      {canEditDelete ? <DeleteButton url={`/api/inventory/${item.id}`} /> : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {items.map((item) => (
          <MobileCard
            key={item.id}
            title={item.name}
            subtitle={item.category}
            href={`/inventory/items/${item.id}`}
            fields={[
              { label: "SKU", value: item.sku || "-" },
              { label: "Quantity", value: Number(item.quantity) },
              ...(canViewCost
                ? [
                    { label: "Avg Cost", value: item.unitCost === null ? "-" : formatMoney(Number(item.unitCost)) },
                    {
                      label: "Last Purchase",
                      value:
                        item.lastPurchasePrice === null || item.lastPurchasePrice === undefined
                          ? "-"
                          : formatMoney(Number(item.lastPurchasePrice)),
                    },
                  ]
                : []),
              ...(canViewSelling
                ? [{ label: "Selling Price", value: item.sellingPrice === null ? "-" : formatMoney(Number(item.sellingPrice)) }]
                : []),
              {
                label: "Stock Health",
                value: getStockTone(item).text,
              },
              ...(canViewCost
                ? [{ label: "Total Value", value: item.totalValue === null ? "-" : formatMoney(Number(item.totalValue)) }]
                : []),
            ]}
            actions={
              showActionsColumn ? (
                <>
                  {canMoveStock ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        setLedgerDialog({ open: true, itemId: item.id, itemName: item.name, defaultType: "ADJUSTMENT" })
                      }
                    >
                      Stock In/Out
                    </Button>
                  ) : null}
                  {canAllocateProject ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        setLedgerDialog({
                          open: true,
                          itemId: item.id,
                          itemName: item.name,
                          defaultType: "PROJECT_ALLOCATION",
                        })
                      }
                    >
                      Allocate
                    </Button>
                  ) : null}
                  {canEditDelete ? (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditItem(item)}>
                      Edit
                    </Button>
                  ) : null}
                  {canEditDelete ? <DeleteButton url={`/api/inventory/${item.id}`} /> : null}
                </>
              ) : null
            }
          />
        ))}
      </div>

      <InventoryLedgerDialog
        open={ledgerDialog.open}
        onOpenChange={(open) => setLedgerDialog({ ...ledgerDialog, open })}
        itemId={ledgerDialog.itemId}
        itemName={ledgerDialog.itemName}
        canViewCost={canViewCost}
        defaultType={ledgerDialog.defaultType}
        canAdjust={canAdjust}
        canRequest={canRequest}
      />
      <InventoryFormDialog
        open={Boolean(editItem)}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
        initialData={
          editItem
            ? {
                id: editItem.id,
                name: editItem.name,
                sku: editItem.sku,
                category: editItem.category,
                unit: editItem.unit,
                unitCost: editItem.unitCost === null ? null : Number(editItem.unitCost),
                sellingPrice: editItem.sellingPrice === null ? null : Number(editItem.sellingPrice),
                minStock: editItem.minStock === undefined ? null : Number(editItem.minStock),
                reorderQty: editItem.reorderQty === undefined ? null : Number(editItem.reorderQty),
              }
            : undefined
        }
      />
    </div>
  );
}
