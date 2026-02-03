"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    role: "Staff",
    initialWalletBalance: "0",
  });

  async function submit() {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        initialWalletBalance: parseFloat(form.initialWalletBalance) || 0,
      }),
    });
    
    const data = await res.json();
    if (!data.success) {
      alert(data.error || "Failed to create employee");
      return;
    }
    
    alert("Employee created successfully!");
    setForm({
      email: "",
      name: "",
      phone: "",
      role: "Staff",
      initialWalletBalance: "0",
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Add Employee</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Initial Wallet Balance (optional)"
          type="number"
          value={form.initialWalletBalance}
          onChange={(e) => setForm({ ...form, initialWalletBalance: e.target.value })}
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
