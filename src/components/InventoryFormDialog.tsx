"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import CategoryAutoComplete from "./CategoryAutoComplete";

interface InventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryFormDialog({ open, onOpenChange }: InventoryFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unit: "",
    unitCost: "",
    sellingPrice: "",
    initialQuantity: "",
    minStock: "",
    reorderQty: "",
  });

  async function submit() {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || undefined,
          category: form.category || undefined,
          unit: form.unit,
          unitCost: form.unitCost ? parseFloat(form.unitCost) : 0,
          sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : 0,
          initialQuantity: form.initialQuantity ? parseFloat(form.initialQuantity) : 0,
          minStock: form.minStock ? parseFloat(form.minStock) : 0,
          reorderQty: form.reorderQty ? parseFloat(form.reorderQty) : 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add inventory item");
      }

      toast.success("Inventory item added successfully!");
      
      // Reset form
      setForm({
        name: "",
        sku: "",
        category: "",
        unit: "",
        unitCost: "",
        sellingPrice: "",
        initialQuantity: "",
        minStock: "",
        reorderQty: "",
      });
      
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
      title="Add Inventory Item"
      description="Add a new item to the inventory system"
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
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              placeholder="Laptop Dell XPS 15"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
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

          <div className="space-y-2">
            <Label htmlFor="unitCost">Purchase Price (Unit Cost)</Label>
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
            {pending ? "Adding..." : "Add Item"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
