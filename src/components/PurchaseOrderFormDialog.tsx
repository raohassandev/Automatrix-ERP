"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import VendorAutoComplete from "@/components/VendorAutoComplete";
import { VendorFormDialog } from "@/components/VendorFormDialog";

type PurchaseOrderItem = {
  itemName: string;
  unit?: string | null;
  quantity: number | string;
  unitCost: number | string;
  project?: string | null;
};

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
  items: PurchaseOrderItem[];
};

const createItem = (): PurchaseOrderItem => ({
  itemName: "",
  unit: "",
  quantity: 1,
  unitCost: 0,
  project: "",
});

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);
  const [form, setForm] = useState({
    poNumber: "",
    vendorId: "",
    vendorName: "",
    vendorContact: "",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    status: "DRAFT",
    currency: "PKR",
    notes: "",
  });
  const [items, setItems] = useState<PurchaseOrderItem[]>([createItem()]);

  useEffect(() => {
    if (open) {
      setVendorRefreshKey((prev) => prev + 1);
      if (purchaseOrder) {
        setForm({
          poNumber: purchaseOrder.poNumber || "",
          vendorId: purchaseOrder.vendorId || "",
          vendorName: purchaseOrder.vendorName || "",
          vendorContact: purchaseOrder.vendorContact || "",
          orderDate: purchaseOrder.orderDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          expectedDate: purchaseOrder.expectedDate?.slice(0, 10) || "",
          status: purchaseOrder.status || "DRAFT",
          currency: purchaseOrder.currency || "PKR",
          notes: purchaseOrder.notes || "",
        });
        setItems(
          purchaseOrder.items?.length
            ? purchaseOrder.items.map((item) => ({
                itemName: item.itemName || "",
                unit: item.unit || "",
                quantity: Number(item.quantity || 0),
                unitCost: Number(item.unitCost || 0),
                project: item.project || "",
              }))
            : [createItem()]
        );
      } else {
        setForm({
          poNumber: "",
          vendorId: "",
          vendorName: "",
          vendorContact: "",
          orderDate: new Date().toISOString().slice(0, 10),
          expectedDate: "",
          status: "DRAFT",
          currency: "PKR",
          notes: "",
        });
        setItems([createItem()]);
      }
    }
  }, [open, purchaseOrder]);

  const updateItem = (index: number, key: keyof PurchaseOrderItem, value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, createItem()]);
  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== index));

  async function submit() {
    if (!form.poNumber || !form.vendorName || !form.orderDate) {
      toast.error("PO number, vendor name, and order date are required");
      return;
    }

    const cleanedItems = items
      .map((item) => ({
        itemName: item.itemName?.trim(),
        unit: item.unit || undefined,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        project: item.project || undefined,
      }))
      .filter((item) => item.itemName);

    if (cleanedItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    const payload = {
      ...form,
      expectedDate: form.expectedDate || undefined,
      notes: form.notes || undefined,
      vendorId: form.vendorId || undefined,
      vendorContact: form.vendorContact || undefined,
      items: cleanedItems,
    };

    const url = purchaseOrder ? `/api/procurement/purchase-orders/${purchaseOrder.id}` : "/api/procurement/purchase-orders";
    const method = purchaseOrder ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save purchase order");
      return;
    }

    toast.success(purchaseOrder ? "Purchase order updated" : "Purchase order created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={purchaseOrder ? "Edit Purchase Order" : "Create Purchase Order"}
      description="Track vendor orders and expected deliveries."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="poNumber">PO Number</Label>
            <Input
              id="poNumber"
              value={form.poNumber}
              onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendorName">Vendor</Label>
            <VendorAutoComplete
              value={form.vendorId}
              onChange={(value) => setForm({ ...form, vendorId: value })}
              onSelectVendor={(vendor) => {
                if (vendor) {
                  setForm((prev) => ({
                    ...prev,
                    vendorId: vendor.id,
                    vendorName: vendor.name,
                    vendorContact: vendor.contactName || prev.vendorContact,
                  }));
                } else {
                  setForm((prev) => ({ ...prev, vendorId: "" }));
                }
              }}
              refreshKey={vendorRefreshKey}
              placeholder="Select vendor (optional)"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setVendorDialogOpen(true)}>
              Create Vendor
            </Button>
            <Input
              id="vendorName"
              placeholder="Vendor name"
              value={form.vendorName}
              onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
              required
              disabled={Boolean(form.vendorId)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendorContact">Vendor Contact</Label>
            <Input
              id="vendorContact"
              value={form.vendorContact}
              onChange={(e) => setForm({ ...form, vendorContact: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orderDate">Order Date</Label>
            <Input
              id="orderDate"
              type="date"
              value={form.orderDate}
              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedDate">Expected Date</Label>
            <Input
              id="expectedDate"
              type="date"
              value={form.expectedDate}
              onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="APPROVED">Approved</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
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
              <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-5">
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
                <div className="space-y-1">
                  <Label>Unit</Label>
                  <Input
                    value={item.unit || ""}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                    placeholder="Unit"
                  />
                </div>
                <div className="space-y-1 md:col-span-5">
                  <Label>Project (optional)</Label>
                  <Input
                    value={item.project || ""}
                    onChange={(e) => updateItem(index, "project", e.target.value)}
                    placeholder="Project reference"
                  />
                </div>
                {items.length > 1 ? (
                  <div className="md:col-span-5">
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
            {pending ? "Saving..." : purchaseOrder ? "Save Changes" : "Create PO"}
          </Button>
        </div>
      </form>
      <VendorFormDialog
        open={vendorDialogOpen}
        onOpenChange={setVendorDialogOpen}
        onSaved={() => setVendorRefreshKey((prev) => prev + 1)}
      />
    </FormDialog>
  );
}
