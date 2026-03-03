"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import ProjectAutoComplete from "./ProjectAutoComplete";
import { toast } from "sonner";

interface InventoryLedgerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  canViewCost?: boolean;
  defaultType?: string;
  canAdjust?: boolean;
  canRequest?: boolean;
}

export function InventoryLedgerDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  canViewCost = true,
  defaultType,
  canAdjust = true,
  canRequest = false,
}: InventoryLedgerDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: defaultType || "ADJUSTMENT",
    warehouseId: "",
    quantity: "",
    unitCost: "",
    reference: "",
    project: "",
  });
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; isDefault?: boolean }>>([]);
  const typeOptions = [
    ...(canAdjust ? ["SALE", "ADJUSTMENT", "RETURN"] : []),
    ...(canAdjust || canRequest ? ["PROJECT_ALLOCATION"] : []),
  ] as const;
  const fallbackType = typeOptions[0] || "PROJECT_ALLOCATION";
  const resolvedDefaultType =
    defaultType && typeOptions.includes(defaultType as (typeof typeOptions)[number]) ? defaultType : fallbackType;

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        type: resolvedDefaultType,
      }));
    }
  }, [open, resolvedDefaultType]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/warehouses")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        setWarehouses(list);
        const defaultWarehouse = list.find((w: { isDefault?: boolean }) => w.isDefault);
        if (defaultWarehouse?.id) {
          setForm((prev) => ({ ...prev, warehouseId: prev.warehouseId || defaultWarehouse.id }));
        }
      })
      .catch(() => {
        if (!cancelled) setWarehouses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit() {
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (form.type === "PROJECT_ALLOCATION" && !form.project) {
      toast.error("Project is required for allocation");
      return;
    }

    try {
      const res = await fetch("/api/inventory/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          type: form.type,
          warehouseId: form.warehouseId || undefined,
          quantity: Number(form.quantity),
          unitCost: form.unitCost ? Number(form.unitCost) : undefined,
          reference: form.reference || undefined,
          project: form.project || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update inventory");
      }

      toast.success("Inventory updated");
      setForm({
        type: fallbackType,
        warehouseId: "",
        quantity: "",
        unitCost: "",
        reference: "",
        project: "",
      });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update inventory");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Inventory Movement — ${itemName}`}
      description="Manual inventory adjustment only. Stock-in purchases must be posted through PO -> GRN."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {canAdjust ? <SelectItem value="SALE">Sale (Stock Out)</SelectItem> : null}
              {canAdjust || canRequest ? <SelectItem value="PROJECT_ALLOCATION">Project Allocation</SelectItem> : null}
              {canAdjust ? <SelectItem value="ADJUSTMENT">Adjustment</SelectItem> : null}
              {canAdjust ? <SelectItem value="RETURN">Return</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="warehouseId">Warehouse</Label>
          <Select
            value={form.warehouseId}
            onValueChange={(value) => setForm((prev) => ({ ...prev, warehouseId: value }))}
          >
            <SelectTrigger id="warehouseId">
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.isDefault ? " (Default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </div>
          {canViewCost ? (
            <div className="space-y-2">
              <Label htmlFor="unitCost">Unit Cost (Optional)</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project">Project (Optional)</Label>
          <ProjectAutoComplete
            value={form.project}
            onChange={(value) => setForm({ ...form, project: value })}
            placeholder="Select project"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference">Reference (Optional)</Label>
          <Input
            id="reference"
            placeholder="PO, GRN, or note"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Movement"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
