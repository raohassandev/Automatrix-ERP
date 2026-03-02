"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { PurchaseOrderFormDialog } from "@/components/PurchaseOrderFormDialog";
import { ProcurementAttachmentsDialog } from "@/components/ProcurementAttachmentsDialog";
import { toast } from "sonner";

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
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const status = (purchaseOrder.status || "DRAFT").toUpperCase();
  const canEdit = status === "DRAFT";
  const canDelete = status === "DRAFT";

  const doAction = async (action: "SUBMIT" | "APPROVE" | "CANCEL") => {
    const res = await fetch(`/api/procurement/purchase-orders/${purchaseOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Action failed");
      return;
    }
    toast.success(`PO ${action.toLowerCase()}d`);
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!canEdit}>
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAttachmentsOpen(true)}>
          Attachments
        </Button>
        {canDelete ? <DeleteButton url={`/api/procurement/purchase-orders/${purchaseOrder.id}`} /> : null}

        <Button
          size="sm"
          variant="outline"
          disabled={pending || status !== "DRAFT"}
          onClick={() => startTransition(() => doAction("SUBMIT"))}
        >
          Submit
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || status !== "SUBMITTED"}
          onClick={() => startTransition(() => doAction("APPROVE"))}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || status === "CANCELLED" || status === "RECEIVED" || status === "PARTIALLY_RECEIVED"}
          onClick={() => startTransition(() => doAction("CANCEL"))}
        >
          Cancel
        </Button>
      </div>
      {editOpen ? (
        <PurchaseOrderFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          purchaseOrder={purchaseOrder}
        />
      ) : null}
      <ProcurementAttachmentsDialog
        open={attachmentsOpen}
        onOpenChange={setAttachmentsOpen}
        title={`PO Attachments — ${purchaseOrder.poNumber}`}
        endpoint={`/api/procurement/purchase-orders/${purchaseOrder.id}/attachments`}
        canEdit={canEdit}
      />
    </>
  );
}
