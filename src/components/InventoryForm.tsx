"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CategoryAutoComplete from "./CategoryAutoComplete";

export default function InventoryForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    category: "",
    unit: "",
    unitCost: "",
    minStock: "",
    reorderQty: "",
  });

  async function submit() {
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        unitCost: Number(form.unitCost),
        minStock: form.minStock ? Number(form.minStock) : undefined,
        reorderQty: form.reorderQty ? Number(form.reorderQty) : undefined,
      }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Add Inventory Item</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Item Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <CategoryAutoComplete
          type="inventory"
          value={form.category}
          onChange={(value) => setForm({ ...form, category: value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Unit"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Unit Cost"
          type="number"
          value={form.unitCost}
          onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Min Stock"
          type="number"
          value={form.minStock}
          onChange={(e) => setForm({ ...form, minStock: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Reorder Qty"
          type="number"
          value={form.reorderQty}
          onChange={(e) => setForm({ ...form, reorderQty: e.target.value })}
        />
      </div>
      <button
        className="mt-4 rounded-md bg-black px-4 py-2 text-white"
        onClick={() => startTransition(submit)}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
