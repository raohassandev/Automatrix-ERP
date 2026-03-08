"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export default function AttachmentForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: "Expense",
    recordId: "",
    fileName: "",
    fileUrl: "",
    fileId: "",
  });

  const isImage = IMAGE_EXT.some((ext) => form.fileUrl.toLowerCase().includes(ext));

  async function submit() {
    if (!form.type || !form.recordId || !form.fileName || !form.fileUrl) {
      toast.error("Type, record ID, file name, and URL are required");
      return;
    }

    const res = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fileId: form.fileId || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save attachment");
      return;
    }

    toast.success("Attachment saved");
    setForm({ type: "Expense", recordId: "", fileName: "", fileUrl: "", fileId: "" });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Add Attachment</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="Expense">Expense</option>
            <option value="Income">Income</option>
            <option value="Invoice">Invoice</option>
            <option value="Project">Project</option>
            <option value="Client">Client</option>
            <option value="Employee">Employee</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Record ID</label>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            placeholder="Paste record ID"
            value={form.recordId}
            onChange={(e) => setForm({ ...form, recordId: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">File Name</label>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            placeholder="Invoice-123.pdf"
            value={form.fileName}
            onChange={(e) => setForm({ ...form, fileName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">File URL</label>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            placeholder="https://..."
            value={form.fileUrl}
            onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium">File ID (optional)</label>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            placeholder="Storage file ID"
            value={form.fileId}
            onChange={(e) => setForm({ ...form, fileId: e.target.value })}
          />
        </div>
      </div>

      {form.fileUrl ? (
        <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="font-medium">Preview</div>
          <div className="mt-2">
            {isImage ? (
              <Image
                src={form.fileUrl}
                alt={form.fileName || "Attachment preview"}
                width={320}
                height={320}
                className="max-h-48 w-auto rounded border bg-background"
                unoptimized
              />
            ) : (
              <a className="text-primary hover:underline" href={form.fileUrl} target="_blank" rel="noreferrer">
                Open attachment
              </a>
            )}
          </div>
        </div>
      ) : null}

      <button
        className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        onClick={() => startTransition(submit)}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
