"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

  async function submit() {
    await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fileId: form.fileId || undefined,
      }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Add Attachment</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Type (Expense, Income, Invoice)"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Record ID"
          value={form.recordId}
          onChange={(e) => setForm({ ...form, recordId: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="File Name"
          value={form.fileName}
          onChange={(e) => setForm({ ...form, fileName: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="File URL"
          value={form.fileUrl}
          onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="File ID (optional)"
          value={form.fileId}
          onChange={(e) => setForm({ ...form, fileId: e.target.value })}
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
