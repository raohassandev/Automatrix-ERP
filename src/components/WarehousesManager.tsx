"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export default function WarehousesManager({
  rows,
  canManage,
}: {
  rows: Warehouse[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", code: "", isDefault: false, isActive: true });

  function createWarehouse(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to create warehouse");
        }
        toast.success("Warehouse created");
        setForm({ name: "", code: "", isDefault: false, isActive: true });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create warehouse");
      }
    });
  }

  function updateWarehouse(id: string, payload: { isDefault?: boolean; isActive?: boolean }) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/warehouses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to update warehouse");
        }
        toast.success("Warehouse updated");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update warehouse");
      }
    });
  }

  return (
    <div className="grid gap-4">
      {canManage ? (
        <form onSubmit={createWarehouse} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Warehouse name"
              className="rounded-md border px-3 py-2 text-sm"
            />
            <input
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="Code (optional)"
              className="rounded-md border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              />
              Default
            </label>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active
            </label>
            <button disabled={pending} className="rounded-md border px-3 py-2 text-sm font-medium">
              {pending ? "Saving..." : "Create Warehouse"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Name</th>
                <th className="py-2">Code</th>
                <th className="py-2">Default</th>
                <th className="py-2">Active</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="py-2">{row.code || "-"}</td>
                  <td className="py-2">{row.isDefault ? "Yes" : "No"}</td>
                  <td className="py-2">{row.isActive ? "Yes" : "No"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {canManage ? (
                        <>
                          {!row.isDefault ? (
                            <button
                              className="rounded-md border px-2 py-1 text-xs"
                              disabled={pending}
                              onClick={() => updateWarehouse(row.id, { isDefault: true })}
                            >
                              Set Default
                            </button>
                          ) : null}
                          <button
                            className="rounded-md border px-2 py-1 text-xs"
                            disabled={pending}
                            onClick={() => updateWarehouse(row.id, { isActive: !row.isActive })}
                          >
                            {row.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </>
                      ) : (
                        "-"
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
