"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { GoodsReceiptFormDialog } from "@/components/GoodsReceiptFormDialog";

type GoodsReceipt = {
  id: string;
  grnNumber: string;
  purchaseOrderId?: string | null;
  receivedDate: string;
  status?: string | null;
  notes?: string | null;
  items: Array<{
    itemName: string;
    unit?: string | null;
    quantity: number | string;
    unitCost: number | string;
  }>;
};

export function GoodsReceiptActions({ receipt }: { receipt: GoodsReceipt }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        <DeleteButton url={`/api/procurement/grn/${receipt.id}`} />
      </div>
      {editOpen ? (
        <GoodsReceiptFormDialog open={editOpen} onOpenChange={setEditOpen} receipt={receipt} />
      ) : null}
    </>
  );
}
