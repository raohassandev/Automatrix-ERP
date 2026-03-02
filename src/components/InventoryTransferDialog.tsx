"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProjectAutoComplete from "@/components/ProjectAutoComplete";
import { toast } from "sonner";

export function InventoryTransferDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  warehouses,
  canViewCost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  warehouses: Array<{ id: string; name: string; isDefault?: boolean }>;
  canViewCost: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    quantity: "",
    unitCost: "",
    project: "",
    reference: "",
  });

  async function submit() {
    if (!form.fromWarehouseId || !form.toWarehouseId) {
      toast.error("Please select source and destination warehouses.");
      return;
    }
    if (form.fromWarehouseId === form.toWarehouseId) {
      toast.error("Source and destination warehouses must be different.");
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }
    const res = await fetch("/api/inventory/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        quantity: Number(form.quantity),
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        project: form.project || undefined,
        reference: form.reference || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Transfer failed");
      return;
    }
    toast.success("Warehouse transfer posted.");
    setForm({
      fromWarehouseId: "",
      toWarehouseId: "",
      quantity: "",
      unitCost: "",
      project: "",
      reference: "",
    });
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Warehouse Transfer — ${itemName}`}
      description="Move stock between warehouses with full ledger trace."
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
            <Label>From Warehouse</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.fromWarehouseId}
              onChange={(e) => setForm((prev) => ({ ...prev, fromWarehouseId: e.target.value }))}
            >
              <option value="">Select source</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>To Warehouse</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.toWarehouseId}
              onChange={(e) => setForm((prev) => ({ ...prev, toWarehouseId: e.target.value }))}
            >
              <option value="">Select destination</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              placeholder="0"
              required
            />
          </div>
          {canViewCost ? (
            <div className="space-y-2">
              <Label>Unit Cost (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setForm((prev) => ({ ...prev, unitCost: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <ProjectAutoComplete
              value={form.project}
              onChange={(value) => setForm((prev) => ({ ...prev, project: value }))}
              placeholder="Select project"
            />
          </div>
          <div className="space-y-2">
            <Label>Reference (optional)</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="Store transfer slip no."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Posting..." : "Post Transfer"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
