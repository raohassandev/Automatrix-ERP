"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    projectId: "",
    name: "",
    client: "",
    startDate: "",
    endDate: "",
    status: "Planning",
    contractValue: "",
  });

  async function submit() {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        contractValue: form.contractValue ? Number(form.contractValue) : 0,
        endDate: form.endDate || undefined,
      }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Create Project</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Project ID"
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Client"
          value={form.client}
          onChange={(e) => setForm({ ...form, client: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Contract Value"
          type="number"
          value={form.contractValue}
          onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
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
