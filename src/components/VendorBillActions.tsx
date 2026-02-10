"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { VendorBillFormDialog } from "@/components/VendorBillFormDialog";
import { toast } from "sonner";

type VendorBill = {
  id: string;
  status: string;
};

export function VendorBillActions({ billId }: { billId: string }) {
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    fetch(`/api/procurement/vendor-bills/${billId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.success && data.data) {
          setBill({ id: data.data.id, status: data.data.status });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [billId]);

  const doAction = async (action: "SUBMIT" | "APPROVE" | "POST" | "VOID") => {
    const res = await fetch(`/api/procurement/vendor-bills/${billId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Action failed");
      return;
    }
    toast.success(`Bill ${action.toLowerCase()}d`);
    setBill((prev) => (prev ? { ...prev, status: data.data?.status || prev.status } : prev));
  };

  if (!bill) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={bill.status !== "DRAFT"}>
        Edit
      </Button>
      <VendorBillFormDialog open={editOpen} onOpenChange={setEditOpen} billId={billId} />

      <Button
        variant="outline"
        size="sm"
        disabled={pending || bill.status !== "DRAFT"}
        onClick={() => startTransition(() => doAction("SUBMIT"))}
      >
        Submit
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || bill.status !== "SUBMITTED"}
        onClick={() => startTransition(() => doAction("APPROVE"))}
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || bill.status !== "APPROVED"}
        onClick={() => startTransition(() => doAction("POST"))}
      >
        Post
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending || bill.status === "POSTED" || bill.status === "VOID"}
        onClick={() => startTransition(() => doAction("VOID"))}
      >
        Void
      </Button>
    </div>
  );
}

