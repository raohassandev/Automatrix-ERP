"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { PurchaseOrderFormDialog } from "@/components/PurchaseOrderFormDialog";

type PurchaseOrder = {
  id: string;
  poNumber: string;
  vendorId?: string | null;
  vendorName: string;
  vendorContact?: string | null;
  orderDate: string;
  expectedDate?: string | null;
  status?: string | null;
  currency?: string | null;
  notes?: string | null;
  items: Array<{
    itemName: string;
    unit?: string | null;
    quantity: number | string;
    unitCost: number | string;
    project?: string | null;
  }>;
};

export function PurchaseOrderActions({ purchaseOrder }: { purchaseOrder: PurchaseOrder }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        <DeleteButton url={`/api/procurement/purchase-orders/${purchaseOrder.id}`} />
      </div>
      {editOpen ? (
        <PurchaseOrderFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          purchaseOrder={purchaseOrder}
        />
      ) : null}
    </>
  );
}
