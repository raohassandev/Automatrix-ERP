"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { GoodsReceiptFormDialog } from "@/components/GoodsReceiptFormDialog";
import { ProcurementAttachmentsDialog } from "@/components/ProcurementAttachmentsDialog";
import { toast } from "sonner";

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
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const status = (receipt.status || "RECEIVED").toUpperCase();
  const canEdit = status === "DRAFT";
  const canDelete = status === "DRAFT";

  const doAction = async (action: "SUBMIT" | "APPROVE" | "POST" | "VOID") => {
    const res = await fetch(`/api/procurement/grn/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Action failed");
      return;
    }
    toast.success(`GRN ${action.toLowerCase()}d`);
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
        {canDelete ? <DeleteButton url={`/api/procurement/grn/${receipt.id}`} /> : null}

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
          variant="outline"
          disabled={pending || status !== "APPROVED"}
          onClick={() => startTransition(() => doAction("POST"))}
        >
          Post
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || status === "POSTED" || status === "RECEIVED" || status === "PARTIAL" || status === "VOID"}
          onClick={() => startTransition(() => doAction("VOID"))}
        >
          Void
        </Button>
      </div>
      {editOpen ? (
        <GoodsReceiptFormDialog open={editOpen} onOpenChange={setEditOpen} receipt={receipt} />
      ) : null}
      <ProcurementAttachmentsDialog
        open={attachmentsOpen}
        onOpenChange={setAttachmentsOpen}
        title={`GRN Attachments — ${receipt.grnNumber}`}
        endpoint={`/api/procurement/grn/${receipt.id}/attachments`}
        canEdit={canEdit}
      />
    </>
  );
}
