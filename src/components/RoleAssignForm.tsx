"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_OPTIONS } from "@/lib/permissions";

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
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Assign Role</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          placeholder="User email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          value={form.roleName}
          onChange={(e) => setForm({ ...form, roleName: e.target.value })}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      <button
        className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        onClick={() => startTransition(submit)}
        disabled={pending}
      >
        {pending ? "Saving..." : "Assign"}
      </button>
    </div>
  );
}
