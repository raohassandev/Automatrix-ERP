"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { ROLE_OPTIONS } from "@/lib/permissions";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    status?: string | null;
  };
}

export function EmployeeFormDialog({ open, onOpenChange, initialData }: EmployeeFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    role: "Staff",
    initialWalletBalance: "",
    status: "ACTIVE",
  };
  const [form, setForm] = useState(emptyForm);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        name: initialData.name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        role: initialData.role || "Staff",
        initialWalletBalance: "",
        status: initialData.status || "ACTIVE",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initialData]);

  async function submit() {
    try {
      const res = await fetch(isEdit ? `/api/employees/${initialData?.id}` : "/api/employees", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit
            ? {
                name: form.name,
                phone: form.phone || null,
                role: form.role,
                status: form.status,
              }
            : {
                name: form.name,
                email: form.email,
                phone: form.phone || null,
                role: form.role,
                initialWalletBalance: form.initialWalletBalance
                  ? parseFloat(form.initialWalletBalance)
                  : 0,
              }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add employee");
      }

      toast.success(isEdit ? "Employee updated successfully!" : "Employee added successfully!");
      
      // Reset form
      setForm(emptyForm);
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error adding employee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add employee");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Employee" : "Add Employee"}
      description={isEdit ? "Update employee record" : "Create a new employee record in the system"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+92 300 1234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="rounded-md border px-3 py-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="initialWalletBalance">Initial Wallet Balance (Optional)</Label>
              <Input
                id="initialWalletBalance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.initialWalletBalance}
                onChange={(e) => setForm({ ...form, initialWalletBalance: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="rounded-md border px-3 py-2"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Employee"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
