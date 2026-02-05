"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteButton({ url }: { url: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onDelete() {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload?.error || "Unable to delete record.");
        return;
      }
      toast.success("Deleted successfully.");
      router.refresh();
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Unable to delete record.");
    }
  }

  return (
    <button
      className="rounded-md border px-3 py-1 text-xs"
      disabled={pending}
      onClick={() => startTransition(onDelete)}
    >
      Delete
    </button>
  );
}

export function QuickEditButton({
  url,
  fields,
}: {
  url: string;
  fields: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onEdit() {
    const next: Record<string, unknown> = {};
    for (const [key, label] of Object.entries(fields)) {
      const value = prompt(`Update ${label}`);
      if (value !== null && value !== "") {
        next[key] = value;
      }
    }
    if (Object.keys(next).length === 0) return;
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    router.refresh();
  }

  return (
    <button
      className="rounded-md bg-black px-3 py-1 text-xs text-white"
      disabled={pending}
      onClick={() => startTransition(onEdit)}
    >
      Edit
    </button>
  );
}
