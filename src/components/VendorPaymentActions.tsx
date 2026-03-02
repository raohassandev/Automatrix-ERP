"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VendorPaymentFormDialog } from "@/components/VendorPaymentFormDialog";
import { ProcurementAttachmentsDialog } from "@/components/ProcurementAttachmentsDialog";
import { toast } from "sonner";

type VendorPayment = {
  id: string;
  paymentNumber: string;
  status: string;
};

export function VendorPaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [payment, setPayment] = useState<VendorPayment | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    fetch(`/api/procurement/vendor-payments/${paymentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.success && data.data) {
          setPayment({
            id: data.data.id,
            paymentNumber: data.data.paymentNumber,
            status: data.data.status,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [paymentId]);

  const doAction = async (action: "SUBMIT" | "APPROVE" | "POST" | "VOID") => {
    const res = await fetch(`/api/procurement/vendor-payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Action failed");
      return;
    }
    toast.success(`Payment ${action.toLowerCase()}d`);
    setPayment((prev) => (prev ? { ...prev, status: data.data?.status || prev.status } : prev));
    router.refresh();
  };

  if (!payment) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={payment.status !== "DRAFT"}>
        Edit
      </Button>
      <Button variant="outline" size="sm" onClick={() => setAttachmentsOpen(true)}>
        Attachments
      </Button>
      <VendorPaymentFormDialog open={editOpen} onOpenChange={setEditOpen} paymentId={paymentId} />
      <ProcurementAttachmentsDialog
        open={attachmentsOpen}
        onOpenChange={setAttachmentsOpen}
        title={`Vendor Payment Attachments — ${payment.paymentNumber}`}
        endpoint={`/api/procurement/vendor-payments/${paymentId}/attachments`}
        canEdit={payment.status === "DRAFT" || payment.status === "SUBMITTED" || payment.status === "APPROVED"}
      />

      <Button
        variant="outline"
        size="sm"
        disabled={pending || payment.status !== "DRAFT"}
        onClick={() => startTransition(() => doAction("SUBMIT"))}
      >
        Submit
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || payment.status !== "SUBMITTED"}
        onClick={() => startTransition(() => doAction("APPROVE"))}
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || payment.status !== "APPROVED"}
        onClick={() => startTransition(() => doAction("POST"))}
      >
        Post
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending || payment.status === "POSTED" || payment.status === "VOID"}
        onClick={() => startTransition(() => doAction("VOID"))}
      >
        Void
      </Button>
    </div>
  );
}
