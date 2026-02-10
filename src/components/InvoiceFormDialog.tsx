"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import ProjectAutoComplete from "./ProjectAutoComplete";
import { ProjectFormDialog } from "./ProjectFormDialog";

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    invoiceNo: string;
    projectId: string;
    date: string | Date;
    dueDate: string | Date;
    amount: number;
    status: string;
    notes?: string | null;
    paymentDate?: string | Date | null;
  };
}

const EMPTY_FORM = {
  invoiceNo: "",
  projectId: "",
  date: "",
  dueDate: "",
  amount: "",
  status: "DRAFT",
  notes: "",
  paymentDate: "",
};

export function InvoiceFormDialog({ open, onOpenChange, initialData }: InvoiceFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        invoiceNo: initialData.invoiceNo || "",
        projectId: initialData.projectId || "",
        date: initialData.date ? new Date(initialData.date).toISOString().slice(0, 10) : "",
        dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().slice(0, 10) : "",
        amount: initialData.amount !== null && initialData.amount !== undefined ? String(initialData.amount) : "",
        status: initialData.status || "DRAFT",
        notes: initialData.notes || "",
        paymentDate: initialData.paymentDate
          ? new Date(initialData.paymentDate).toISOString().slice(0, 10)
          : "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, initialData]);

  async function submit() {
    try {
      const res = await fetch(isEdit ? `/api/invoices/${initialData?.id}` : "/api/invoices", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit
            ? {
                dueDate: form.dueDate || undefined,
                amount: parseFloat(form.amount),
                status: form.status,
                notes: form.notes || undefined,
                paymentDate: form.paymentDate || undefined,
              }
            : {
                invoiceNo: form.invoiceNo,
                projectId: form.projectId,
                date: form.date,
                dueDate: form.dueDate,
                amount: parseFloat(form.amount),
                status: form.status,
                notes: form.notes || undefined,
              }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      toast.success(isEdit ? "Invoice updated successfully!" : "Invoice created successfully!");
      
      // Reset form
      setForm(EMPTY_FORM);
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Invoice" : "Create Invoice"}
      description={isEdit ? "Update invoice details" : "Generate a new invoice for a client"}
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
            <Label htmlFor="invoiceNo">Invoice Number</Label>
            <Input
              id="invoiceNo"
              placeholder="INV-2026-001"
              value={form.invoiceNo}
              onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectId">Project</Label>
            <ProjectAutoComplete
              value={form.projectId}
              onChange={(value) => setForm({ ...form, projectId: value })}
              placeholder="Select project"
              refreshKey={projectRefreshKey}
            />
            {!isEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProjectDialogOpen(true)}
                className="mt-2"
              >
                Create Project
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Issue Date</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (PKR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="Invoice notes or description"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date (Optional)</Label>
              <Input
                id="paymentDate"
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              />
            </div>
          ) : null}
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
            {pending ? "Creating..." : "Create Invoice"}
          </Button>
        </div>
      </form>
      <ProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onCreated={() => setProjectRefreshKey((prev) => prev + 1)}
      />
    </FormDialog>
  );
}
