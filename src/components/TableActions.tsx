"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function isProjectDeleteUrl(url: string) {
  return /^\/api\/projects\/[^/?#]+(?:\?.*)?$/i.test(url);
}

function withQuery(url: string, query: string) {
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
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
          const actionInput = prompt(
            `${payload?.error || "Project cannot be deleted because it has linked records."}\n\nType CLOSE to close the project and keep linked records.\nType HARD DELETE to permanently remove this project and linked records (CEO/Owner only).`,
          );
          const action = String(actionInput || "").trim().toUpperCase().replace(/\s+/g, " ");
          if (action === "CLOSE") {
            const closeRes = await fetch(withQuery(url, "onConflict=close"), { method: "DELETE" });
            if (!closeRes.ok) {
              const closePayload = await closeRes.json().catch(() => ({}));
              toast.error(closePayload?.error || "Unable to close linked project.");
              return;
            }
            toast.success("Project closed successfully. Linked records were preserved.");
            router.refresh();
            return;
          }

          if (action === "HARD DELETE") {
            const finalConfirm = prompt(
              "Final confirmation required.\nType DELETE FOREVER to permanently remove this project and all linked records.",
            );
            const confirmed = String(finalConfirm || "").trim().toUpperCase();
            if (confirmed !== "DELETE FOREVER") {
              toast.error("Hard delete cancelled.");
              return;
            }
            const hardRes = await fetch(withQuery(url, "onConflict=hard&confirm=DELETE_FOREVER"), { method: "DELETE" });
            if (!hardRes.ok) {
              const hardPayload = await hardRes.json().catch(() => ({}));
              toast.error(hardPayload?.error || "Unable to hard delete linked project.");
              return;
            }
            toast.success("Project and linked records permanently deleted.");
            router.refresh();
            return;
          }

          if (action) {
            toast.error("Invalid action. Use CLOSE or HARD DELETE.");
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
