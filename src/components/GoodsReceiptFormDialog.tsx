"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ProjectAutoComplete from "@/components/ProjectAutoComplete";

type GoodsReceiptItem = {
  itemName: string;
  unit?: string | null;
  quantity: number | string;
  unitCost: number | string;
};

type GoodsReceipt = {
  id: string;
  grnNumber: string;
  purchaseOrderId?: string | null;
  projectRef?: string | null;
  receivedDate: string;
  notes?: string | null;
  items: GoodsReceiptItem[];
};

const createItem = (): GoodsReceiptItem => ({
  itemName: "",
  unit: "",
  quantity: 1,
  unitCost: 0,
});

type GoodsReceiptFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt?: GoodsReceipt | null;
  initialProjectRef?: string;
};

const buildInitialForm = (receipt: GoodsReceipt | null | undefined, initialProjectRef?: string) => ({
  grnNumber: receipt?.grnNumber || "",
  purchaseOrderId: receipt?.purchaseOrderId || "",
  projectRef: receipt?.projectRef || initialProjectRef || "",
  receivedDate: receipt?.receivedDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  notes: receipt?.notes || "",
});

const buildInitialItems = (receipt: GoodsReceipt | null | undefined) =>
  receipt?.items?.length
    ? receipt.items.map((item) => ({
        itemName: item.itemName || "",
        unit: item.unit || "",
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unitCost || 0),
      }))
    : [createItem()];

export function GoodsReceiptFormDialog(props: GoodsReceiptFormDialogProps) {
  const key = `${props.open ? "open" : "closed"}-${props.receipt?.id || "new"}`;
  return <GoodsReceiptFormDialogInner key={key} {...props} />;
}

function GoodsReceiptFormDialogInner({
  open,
  onOpenChange,
  receipt,
  initialProjectRef,
}: GoodsReceiptFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => buildInitialForm(receipt, initialProjectRef));
  const [items, setItems] = useState<GoodsReceiptItem[]>(() => buildInitialItems(receipt));

  const updateItem = (index: number, key: keyof GoodsReceiptItem, value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, createItem()]);
  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== index));

  async function submit() {
    if (!form.grnNumber || !form.receivedDate) {
      toast.error("GRN number and received date are required");
      return;
    }

    const cleanedItems = items
      .map((item) => ({
        itemName: item.itemName?.trim(),
        unit: item.unit || undefined,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      }))
      .filter((item) => item.itemName);

    if (cleanedItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    const payload = {
      ...form,
      purchaseOrderId: form.purchaseOrderId || undefined,
      projectRef: form.projectRef || undefined,
      notes: form.notes || undefined,
      items: cleanedItems,
    };

    const url = receipt ? `/api/procurement/grn/${receipt.id}` : "/api/procurement/grn";
    const method = receipt ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save goods receipt");
      return;
    }

    toast.success(receipt ? "Goods receipt updated" : "Goods receipt created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={receipt ? "Edit Goods Receipt" : "Create Goods Receipt"}
      description="Record inventory received against a purchase order."
    >
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Phase 1 lifecycle: GRNs are created as <span className="font-medium text-foreground">DRAFT</span>. Stock is
        posted to Inventory Ledger only after <span className="font-medium text-foreground">Submit → Approve → Post</span>.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grnNumber">GRN Number</Label>
            <Input
              id="grnNumber"
              value={form.grnNumber}
              onChange={(e) => setForm({ ...form, grnNumber: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchaseOrderId">Purchase Order ID</Label>
            <Input
              id="purchaseOrderId"
              value={form.purchaseOrderId}
              onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              If you link a GRN to a PO, the Project is inherited from the PO (Phase 1 rule).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <ProjectAutoComplete
              value={form.projectRef}
              onChange={(value) => setForm({ ...form, projectRef: value })}
              placeholder="Select project (optional)..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receivedDate">Received Date</Label>
            <Input
              id="receivedDate"
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items</h3>
            <Button type="button" variant="outline" onClick={addItem}>
              Add Item
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2">
                  <Label>Item</Label>
                  <Input
                    value={item.itemName}
                    onChange={(e) => updateItem(index, "itemName", e.target.value)}
                    placeholder="Item name"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    min={1}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    value={item.unitCost}
                    onChange={(e) => updateItem(index, "unitCost", e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Unit</Label>
                  <Input
                    value={item.unit || ""}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                    placeholder="Unit"
                  />
                </div>
                {items.length > 1 ? (
                  <div className="md:col-span-4">
                    <Button type="button" variant="ghost" onClick={() => removeItem(index)}>
                      Remove Item
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : receipt ? "Save Changes" : "Create GRN"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
