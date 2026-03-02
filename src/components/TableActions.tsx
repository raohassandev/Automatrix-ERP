"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { formatMoney } from "@/lib/format";

function isProjectDeleteUrl(url: string) {
  return /^\/api\/projects\/[^/?#]+(?:\?.*)?$/i.test(url);
}

function extractProjectIdFromDeleteUrl(url: string) {
  const match = url.match(/^\/api\/projects\/([^/?#]+)(?:\?.*)?$/i);
  return match?.[1] || null;
}

type LinkedRecordType =
  | "expense"
  | "income"
  | "invoice"
  | "purchaseOrder"
  | "goodsReceipt"
  | "vendorBill"
  | "vendorPayment"
  | "inventoryLedger"
  | "manualJournalLine"
  | "quotation"
  | "incentive"
  | "commission";

type LinkedRecordItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  amount?: number | null;
  date?: string | null;
};

type LinkedRecordGroup = {
  key: LinkedRecordType;
  label: string;
  actionLabel: string;
  count: number;
  items: LinkedRecordItem[];
};

type LinkedProjectData = {
  project: {
    id: string;
    projectId: string;
    name: string;
  };
  totalLinked: number;
  groups: LinkedRecordGroup[];
};

export function DeleteButton({ url }: { url: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cleanupData, setCleanupData] = useState<LinkedProjectData | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const projectId = useMemo(() => extractProjectIdFromDeleteUrl(url), [url]);

  async function loadLinkedRecords() {
    if (!projectId) return;
    setCleanupLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/linked-records`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Unable to load linked project records.");
        return;
      }
      setCleanupData(payload?.data || null);
    } catch (error) {
      console.error("Failed to load linked project records:", error);
      toast.error("Unable to load linked project records.");
    } finally {
      setCleanupLoading(false);
    }
  }

  async function deleteLinkedItem(type: LinkedRecordType, recordId: string) {
    if (!projectId) return;
    setBusyKey(`${type}:${recordId}`);
    try {
      const res = await fetch(`/api/projects/${projectId}/linked-records`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recordId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Unable to delete linked record.");
        return;
      }
      toast.success("Linked record deleted.");
      await loadLinkedRecords();
    } catch (error) {
      console.error("Delete linked record failed:", error);
      toast.error("Unable to delete linked record.");
    } finally {
      setBusyKey(null);
    }
  }

  async function attemptDeleteRecord() {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 && isProjectDeleteUrl(url) && projectId) {
          setConfirmOpen(false);
          setCleanupOpen(true);
          await loadLinkedRecords();
          toast.error(payload?.error || "Project has linked records. Remove linked records first.");
          return;
        }

        toast.error(payload?.error || "Unable to delete record.");
        return;
      }

      toast.success("Deleted successfully.");
      setConfirmOpen(false);
      setCleanupOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Unable to delete record.");
    } finally {
      setBusy(false);
    }
  }

  const totalLinked = cleanupData?.totalLinked || 0;

  return (
    <>
      <button
        className="rounded-md border px-3 py-1 text-xs"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        Delete
      </button>

      <FormDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Deletion"
        description="This action cannot be undone. Please confirm you want to delete this record."
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            For projects with linked records, a cleanup screen will open so you can remove linked items first.
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy || pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => startTransition(attemptDeleteRecord)}
              disabled={busy || pending}
            >
              {busy ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        title="Project Linked Records"
        description="Delete linked records one by one. Project delete will be enabled once linked count reaches zero."
        className="max-w-5xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <div className="text-xs text-sky-700">Project</div>
              <div className="text-sm font-semibold text-sky-900">
                {cleanupData?.project?.projectId || "-"}
                {cleanupData?.project?.name ? ` • ${cleanupData.project.name}` : ""}
              </div>
            </div>
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
              <div className="text-xs text-rose-700">Linked Records</div>
              <div className="text-lg font-semibold text-rose-900">{totalLinked}</div>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs text-emerald-700">Project Deletion</div>
              <div className="text-sm font-semibold text-emerald-900">{totalLinked === 0 ? "Ready" : "Blocked"}</div>
            </div>
          </div>

          {cleanupLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading linked records...</div>
          ) : null}

          {!cleanupLoading && cleanupData && cleanupData.groups.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              No linked records found. You can now delete the project.
            </div>
          ) : null}

          {!cleanupLoading && cleanupData ? (
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {cleanupData.groups.map((group) => (
                <div key={group.key} className="rounded-md border">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {group.label} ({group.count})
                    </div>
                    <div className="text-xs text-slate-600">Action: {group.actionLabel}</div>
                  </div>
                  <div className="space-y-2 p-3">
                    {group.items.map((item) => {
                      const key = `${group.key}:${item.id}`;
                      const isBusy = busyKey === key;
                      return (
                        <div
                          key={key}
                          className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">{item.title}</div>
                            <div className="truncate text-xs text-slate-600">{item.subtitle || "No additional details"}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                              {item.status ? <span>Status: {item.status}</span> : null}
                              {item.date ? <span>Date: {item.date}</span> : null}
                              {item.amount != null ? <span>Amount: {formatMoney(item.amount)}</span> : null}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={isBusy || busy}
                              onClick={() => deleteLinkedItem(group.key, item.id)}
                            >
                              {isBusy ? `${group.actionLabel}...` : group.actionLabel}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => loadLinkedRecords()} disabled={cleanupLoading || busy}>
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={() => setCleanupOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || totalLinked > 0}
              onClick={() => startTransition(attemptDeleteRecord)}
            >
              {busy ? "Deleting Project..." : "Delete Project"}
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}
