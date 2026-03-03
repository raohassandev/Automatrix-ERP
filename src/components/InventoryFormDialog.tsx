"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import CategoryAutoComplete from "./CategoryAutoComplete";
import { type RoleName } from "@/lib/permissions";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";

interface InventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    name: string;
    sku?: string | null;
    category?: string | null;
    unit: string;
    unitCost?: number | null;
    sellingPrice?: number | null;
    minStock?: number | null;
    reorderQty?: number | null;
  };
}

const EMPTY_FORM = {
  name: "",
  sku: "",
  category: "",
  unit: "",
  unitCost: "",
  sellingPrice: "",
  initialQuantity: "",
  minStock: "",
  reorderQty: "",
};

export function InventoryFormDialog({ open, onOpenChange, initialData }: InventoryFormDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const { canAccess } = useEffectivePermissions(roleName);
  const canViewCost = canAccess(["inventory.view_cost"]);
  const canViewSelling = canAccess(["inventory.view_selling"]);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_FORM);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        ...EMPTY_FORM,
        name: initialData.name || "",
        sku: initialData.sku || "",
        category: initialData.category || "",
        unit: initialData.unit || "",
        unitCost:
          initialData.unitCost !== null && initialData.unitCost !== undefined
            ? String(initialData.unitCost)
            : "",
        sellingPrice:
          initialData.sellingPrice !== null && initialData.sellingPrice !== undefined
            ? String(initialData.sellingPrice)
            : "",
        initialQuantity: "",
        minStock:
          initialData.minStock !== null && initialData.minStock !== undefined
            ? String(initialData.minStock)
            : "",
        reorderQty:
          initialData.reorderQty !== null && initialData.reorderQty !== undefined
            ? String(initialData.reorderQty)
            : "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, initialData]);

  async function submit() {
    try {
      if (!isEdit && !form.name.trim()) {
        toast.error("Item name is required.");
        return;
      }
      if (!form.unit.trim()) {
        toast.error("Unit is required.");
        return;
      }
      const numericFields = [
        ["Avg Cost", form.unitCost],
        ["Selling Price", form.sellingPrice],
        ["Initial Quantity", form.initialQuantity],
        ["Minimum Stock", form.minStock],
        ["Reorder Qty", form.reorderQty],
      ] as const;
      for (const [label, value] of numericFields) {
        if (value === "") continue;
        if (!Number.isFinite(Number(value)) || Number(value) < 0) {
          toast.error(`${label} must be a valid non-negative number.`);
          return;
        }
      }

      const res = await fetch(isEdit ? `/api/inventory/${initialData?.id}` : "/api/inventory", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit
            ? {
                sku: form.sku ? form.sku : null,
                category: form.category || undefined,
                unit: form.unit || undefined,
                unitCost: canViewCost ? (form.unitCost ? parseFloat(form.unitCost) : undefined) : undefined,
                sellingPrice: canViewSelling ? (form.sellingPrice ? parseFloat(form.sellingPrice) : undefined) : undefined,
                minStock: form.minStock ? parseFloat(form.minStock) : undefined,
                reorderQty: form.reorderQty ? parseFloat(form.reorderQty) : undefined,
              }
            : {
                name: form.name,
                sku: form.sku || undefined,
                category: form.category || undefined,
                unit: form.unit,
                unitCost: canViewCost ? (form.unitCost ? parseFloat(form.unitCost) : 0) : 0,
                sellingPrice: canViewSelling ? (form.sellingPrice ? parseFloat(form.sellingPrice) : 0) : 0,
                initialQuantity: form.initialQuantity ? parseFloat(form.initialQuantity) : 0,
                minStock: form.minStock ? parseFloat(form.minStock) : 0,
                reorderQty: form.reorderQty ? parseFloat(form.reorderQty) : 0,
              }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add inventory item");
      }

      toast.success(isEdit ? "Inventory item updated successfully!" : "Inventory item added successfully!");
      
      // Reset form
      setForm(EMPTY_FORM);
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error adding inventory item:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add inventory item");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Inventory Item" : "Add Inventory Item"}
      description={isEdit ? "Update item details used in stock and valuation reports." : "Simple setup: item name, unit, and opening values."}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Use clear item names and units (e.g., pcs, meter, kg). Accurate opening values improve stock and cost reports.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              placeholder="Laptop Dell XPS 15"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU (Optional)</Label>
            <Input
              id="sku"
              placeholder="DELL-XPS-15-001"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <CategoryAutoComplete
              type="inventory"
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              placeholder="Nos / Kg / Meters"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              required
            />
          </div>

          {canViewCost ? (
            <div className="space-y-2">
              <Label htmlFor="unitCost">Avg Cost (Initial)</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                required
              />
            </div>
          ) : null}

          {canViewSelling ? (
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price (PKR)</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                required
              />
            </div>
          ) : null}

          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="initialQuantity">Initial Quantity (Optional)</Label>
              <Input
                id="initialQuantity"
                type="number"
                step="0.01"
                placeholder="0"
                value={form.initialQuantity}
                onChange={(e) => setForm({ ...form, initialQuantity: e.target.value })}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="minStock">Minimum Stock Level</Label>
            <Input
              id="minStock"
              type="number"
              placeholder="5"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reorderQty">Reorder Qty (Optional)</Label>
            <Input
              id="reorderQty"
              type="number"
              placeholder="0"
              value={form.reorderQty}
              onChange={(e) => setForm({ ...form, reorderQty: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
