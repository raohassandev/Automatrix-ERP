"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  initialData?: {
    id: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    status?: string | null;
  };
}

export function VendorFormDialog({ open, onOpenChange, onSaved, initialData }: VendorFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    status: "ACTIVE",
  });
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        name: initialData.name || "",
        contactName: initialData.contactName || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        address: initialData.address || "",
        notes: initialData.notes || "",
        status: initialData.status || "ACTIVE",
      });
    } else {
      setForm({
        name: "",
        contactName: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
        status: "ACTIVE",
      });
    }
  }, [open, initialData]);

  async function submit() {
    if (!form.name) {
      toast.error("Vendor name is required");
      return;
    }
    const payload = {
      name: form.name,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
      status: form.status || undefined,
    };
    const url = isEdit ? `/api/vendors/${initialData?.id}` : "/api/vendors";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save vendor");
      }
      toast.success(isEdit ? "Vendor updated" : "Vendor created");
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save vendor");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Vendor" : "Create Vendor"}
      description="Manage vendor master records."
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
            <Label htmlFor="name">Vendor Name</Label>
            <Input
              id="name"
              placeholder="ABC Traders"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Person</Label>
            <Input
              id="contactName"
              placeholder="Ali Khan"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="+92 300 1234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vendor@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Street, City"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Payment terms, contact notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
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
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Vendor"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
