"use client";

import { useState } from "react";
import { InventoryLedgerDialog } from "@/components/InventoryLedgerDialog";
import { InventoryTransferDialog } from "@/components/InventoryTransferDialog";

export function InventoryLedgerActions({
  items,
  canViewCost,
  warehouses,
}: {
  items: Array<{ id: string; name: string }>;
  canViewCost: boolean;
  warehouses: Array<{ id: string; name: string; isDefault?: boolean }>;
}) {
  const [dialog, setDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
    defaultType?: string;
  }>({ open: false, itemId: "", itemName: "" });
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-md border px-3 py-2 text-sm"
        value={dialog.itemId}
        onChange={(e) => {
          const item = items.find((i) => i.id === e.target.value);
          setDialog((prev) => ({
            ...prev,
            itemId: e.target.value,
            itemName: item?.name || "",
          }));
        }}
      >
        <option value="">Select item</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() =>
          setDialog((prev) => ({
            ...prev,
            open: true,
            defaultType: "ADJUSTMENT",
          }))
        }
        disabled={!dialog.itemId}
      >
        Manual Adjustment
      </button>
      <button
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() =>
          setDialog((prev) => ({
            ...prev,
            open: true,
            defaultType: "PROJECT_ALLOCATION",
          }))
        }
        disabled={!dialog.itemId}
      >
        Allocate to Project
      </button>
      <button
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setTransferOpen(true)}
        disabled={!dialog.itemId}
      >
        Transfer Warehouse
      </button>

      <InventoryLedgerDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        itemId={dialog.itemId}
        itemName={dialog.itemName || "Inventory Item"}
        canViewCost={canViewCost}
        defaultType={dialog.defaultType}
      />
      <InventoryTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        itemId={dialog.itemId}
        itemName={dialog.itemName || "Inventory Item"}
        warehouses={warehouses}
        canViewCost={canViewCost}
      />
    </div>
  );
}
