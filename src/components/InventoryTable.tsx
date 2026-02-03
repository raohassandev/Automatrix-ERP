"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { MobileCard } from "@/components/MobileCard";
import { InventoryLedgerDialog } from "@/components/InventoryLedgerDialog";
import { Button } from "@/components/ui/button";

interface InventoryItemRow {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  quantity: number | string;
  unitCost: number | string;
  sellingPrice: number | string;
  totalValue: number | string;
}

export function InventoryTable({ items }: { items: InventoryItemRow[] }) {
  const [ledgerDialog, setLedgerDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
  }>({ open: false, itemId: "", itemName: "" });

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
              <th className="py-2">Unit Cost</th>
              <th className="py-2">Selling Price</th>
              <th className="py-2">Total</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.name}</td>
                <td className="py-2">{item.sku || "-"}</td>
                <td className="py-2">{item.category}</td>
                <td className="py-2">{Number(item.quantity)}</td>
                <td className="py-2">{formatMoney(Number(item.unitCost))}</td>
                <td className="py-2">{formatMoney(Number(item.sellingPrice))}</td>
                <td className="py-2">{formatMoney(Number(item.totalValue))}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setLedgerDialog({ open: true, itemId: item.id, itemName: item.name })
                      }
                    >
                      Stock In/Out
                    </Button>
                    <QuickEditButton
                      url={`/api/inventory/${item.id}`}
                      fields={{
                        unitCost: "Unit Cost",
                        sellingPrice: "Selling Price",
                        minStock: "Min Stock",
                        reorderQty: "Reorder Qty",
                      }}
                    />
                    <DeleteButton url={`/api/inventory/${item.id}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {items.map((item) => (
          <MobileCard
            key={item.id}
            title={item.name}
            subtitle={item.category}
            fields={[
              { label: "SKU", value: item.sku || "-" },
              { label: "Quantity", value: Number(item.quantity) },
              { label: "Unit Cost", value: formatMoney(Number(item.unitCost)) },
              { label: "Selling Price", value: formatMoney(Number(item.sellingPrice)) },
              { label: "Total Value", value: formatMoney(Number(item.totalValue)) },
            ]}
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setLedgerDialog({ open: true, itemId: item.id, itemName: item.name })
                  }
                >
                  Stock In/Out
                </Button>
                <QuickEditButton
                  url={`/api/inventory/${item.id}`}
                  fields={{
                    unitCost: "Unit Cost",
                    sellingPrice: "Selling Price",
                    minStock: "Min Stock",
                    reorderQty: "Reorder Qty",
                  }}
                />
                <DeleteButton url={`/api/inventory/${item.id}`} />
              </>
            }
          />
        ))}
      </div>

      <InventoryLedgerDialog
        open={ledgerDialog.open}
        onOpenChange={(open) => setLedgerDialog({ ...ledgerDialog, open })}
        itemId={ledgerDialog.itemId}
        itemName={ledgerDialog.itemName}
      />
    </div>
  );
}
