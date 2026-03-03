"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CategoryAutoComplete from "./CategoryAutoComplete";
import { normalizeInventoryName, normalizeSku } from "@/lib/inventory-identity";
import { toast } from "sonner";
import Link from "next/link";

export default function InventoryForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [similarItems, setSimilarItems] = useState<
    Array<{ id: string; name: string; canonicalName: string; sku: string | null; category: string; unit: string; quantity: number }>
  >([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
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
  const normalizedName = normalizeInventoryName(form.name);
  const normalizedSku = normalizeSku(form.sku);
  const exactDuplicate = similarItems.find(
    (item) =>
      item.canonicalName === normalizedName ||
      (normalizedSku && item.sku && normalizeSku(item.sku) === normalizedSku),
  );

  useEffect(() => {
    const q = form.name.trim();
    const sku = form.sku.trim();
    if (!q && !sku) {
      setSimilarItems([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingSimilar(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (sku) params.set("sku", sku);
        const res = await fetch(`/api/inventory/similar?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to search");
        setSimilarItems(Array.isArray(json?.data) ? json.data : []);
      } catch {
        setSimilarItems([]);
      } finally {
        setLoadingSimilar(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [form.name, form.sku]);

  async function submit() {
    if (exactDuplicate) {
      toast.error("Similar item already exists. Use existing item to keep one stock history.");
      return;
    }
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        unitCost: Number(form.unitCost),
        sellingPrice: Number(form.sellingPrice),
        initialQuantity: form.initialQuantity ? Number(form.initialQuantity) : undefined,
        minStock: form.minStock ? Number(form.minStock) : undefined,
        reorderQty: form.reorderQty ? Number(form.reorderQty) : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const duplicateName = data?.duplicate?.name ? ` Existing: ${data.duplicate.name}.` : "";
      toast.error((data?.error || "Failed to save inventory item") + duplicateName);
      return;
    }
    toast.success("Inventory item added successfully.");
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
        <input
          className="rounded-md border px-3 py-2"
          placeholder="SKU (optional)"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
        {(loadingSimilar || similarItems.length > 0) ? (
          <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <div className="font-medium text-amber-900 dark:text-amber-100">
              {loadingSimilar ? "Checking similar items..." : "Similar existing items"}
            </div>
            {!loadingSimilar ? (
              <div className="mt-2 space-y-2">
                {similarItems.length === 0 ? (
                  <div className="text-xs text-amber-800 dark:text-amber-200">No similar items found.</div>
                ) : (
                  similarItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded border border-amber-200 bg-background/70 p-2 dark:border-amber-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {item.sku || "-"} | {item.category} | {item.unit} | Stock: {item.quantity}
                          </div>
                        </div>
                        <Link href={`/inventory/items/${item.id}`} className="text-xs font-medium text-sky-700 underline underline-offset-2 dark:text-sky-300">
                          Use existing
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
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
          placeholder="Selling Price"
          type="number"
          value={form.sellingPrice}
          onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Initial Quantity (optional)"
          type="number"
          value={form.initialQuantity}
          onChange={(e) => setForm({ ...form, initialQuantity: e.target.value })}
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
        disabled={pending || Boolean(exactDuplicate)}
      >
        {pending ? "Saving..." : exactDuplicate ? "Duplicate Found" : "Save"}
      </button>
    </div>
  );
}
