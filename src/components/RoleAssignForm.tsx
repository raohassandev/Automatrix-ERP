"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RoleAssignForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    email: "",
    roleName: "Staff",
  });

  async function submit() {
    await fetch("/api/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Assign Role</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="User email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Role (Owner, CEO, Finance Manager, Manager, Staff, Guest)"
          value={form.roleName}
          onChange={(e) => setForm({ ...form, roleName: e.target.value })}
        />
      </div>
      <button
        className="mt-4 rounded-md bg-black px-4 py-2 text-white"
        onClick={() => startTransition(submit)}
        disabled={pending}
      >
        {pending ? "Saving..." : "Assign"}
      </button>
    </div>
  );
}
