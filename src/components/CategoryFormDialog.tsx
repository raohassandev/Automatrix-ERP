"use client";

import { useState } from "react";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CategoryFormDialog({ open, onOpenChange, onCreated }: CategoryFormDialogProps) {
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "expense",
    description: "",
    maxAmount: "",
    enforceStrict: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setPending(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description,
        maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
        enforceStrict: form.enforceStrict,
      };
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create category");
      }

      toast.success("Category created successfully");
      setForm({
        name: "",
        type: "expense",
        description: "",
        maxAmount: "",
        enforceStrict: false,
      });
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Category"
      description="Add a new category for expenses, inventory, or income"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Category Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter category name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              className="rounded-md border px-3 py-2 w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="expense">Expense</option>
              <option value="inventory">Inventory</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Max Amount (PKR)</label>
            <Input
              type="number"
              value={form.maxAmount}
              onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
              placeholder="Optional limit"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="enforceStrict"
              type="checkbox"
              className="h-4 w-4"
              checked={form.enforceStrict}
              onChange={(e) => setForm({ ...form, enforceStrict: e.target.checked })}
            />
            <label htmlFor="enforceStrict" className="text-sm font-medium">
              Enforce strict limit
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create Category"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
