"use client";

import { useEffect, useState, useTransition } from "react";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AttachmentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
};

export function ProcurementAttachmentsDialog({
  open,
  onOpenChange,
  title,
  endpoint,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  endpoint: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [form, setForm] = useState({ fileName: "", url: "", mimeType: "", sizeBytes: "" });

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to load attachments");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, endpoint]);

  function submit() {
    startTransition(async () => {
      try {
        if (!form.fileName.trim() || !form.url.trim()) {
          throw new Error("File name and URL are required.");
        }
        const payload = {
          fileName: form.fileName.trim(),
          url: form.url.trim(),
          mimeType: form.mimeType.trim() || undefined,
          sizeBytes: form.sizeBytes ? Number(form.sizeBytes) : undefined,
        };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to save attachment");

        toast.success("Attachment added");
        setForm({ fileName: "", url: "", mimeType: "", sizeBytes: "" });
        await loadRows();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save attachment");
      }
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Document links and files for procurement audit trail."
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          Attach vendor invoices, challans, delivery slips, and approvals here.
        </div>

        {canEdit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-3 rounded-md border p-3"
          >
            <div className="space-y-1">
              <Label htmlFor="att-url">URL</Label>
              <Input
                id="att-url"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="att-name">File Name</Label>
              <Input
                id="att-name"
                placeholder="invoice-001.pdf"
                value={form.fileName}
                onChange={(e) => setForm((prev) => ({ ...prev, fileName: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="att-mime">MIME Type (optional)</Label>
                <Input
                  id="att-mime"
                  placeholder="application/pdf"
                  value={form.mimeType}
                  onChange={(e) => setForm((prev) => ({ ...prev, mimeType: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="att-size">Size Bytes (optional)</Label>
                <Input
                  id="att-size"
                  placeholder="12345"
                  value={form.sizeBytes}
                  onChange={(e) => setForm((prev) => ({ ...prev, sizeBytes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving..." : "Add Attachment"}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">Existing Attachments</div>
          {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
          {!loading && rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No attachments found.</div>
          ) : null}
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded border p-2 text-sm">
                <div className="font-medium">{row.fileName}</div>
                <a href={row.fileUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline underline-offset-2">
                  Open
                </a>
                <div className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
