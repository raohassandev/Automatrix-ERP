"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function isProjectDeleteUrl(url: string) {
  return /^\/api\/projects\/[^/?#]+(?:\?.*)?$/i.test(url);
}

export function DeleteButton({ url }: { url: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onDelete() {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));

        if (res.status === 409 && isProjectDeleteUrl(url)) {
          const shouldCloseInstead = confirm(
            `${payload?.error || "Project cannot be deleted because it has linked records."}\n\nClick OK to close this project instead and keep all linked records.`,
          );
          if (shouldCloseInstead) {
            const separator = url.includes("?") ? "&" : "?";
            const closeRes = await fetch(`${url}${separator}onConflict=close`, { method: "DELETE" });
            if (!closeRes.ok) {
              const closePayload = await closeRes.json().catch(() => ({}));
              toast.error(closePayload?.error || "Unable to close linked project.");
              return;
            }
            toast.success("Project closed successfully. Linked records were preserved.");
            router.refresh();
            return;
          }
        }

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
