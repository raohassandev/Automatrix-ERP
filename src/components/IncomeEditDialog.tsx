"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DatePicker } from "./ui/date-picker";
import { toast } from "sonner";
import { format } from "date-fns";
import ProjectAutoComplete from "./ProjectAutoComplete";
import { ProjectFormDialog } from "./ProjectFormDialog";

type IncomeEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: {
    id: string;
    date: string | Date;
    source: string;
    amount: number;
    paymentMode: string;
    project?: string | null;
    invoiceId?: string | null;
    remarks?: string | null;
  };
};

export function IncomeEditDialog({ open, onOpenChange, entry }: IncomeEditDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [date, setDate] = useState<Date | undefined>(
    entry.date ? new Date(entry.date) : undefined
  );
  const [form, setForm] = useState({
    source: entry.source || "",
    amount: entry.amount ? String(entry.amount) : "",
    paymentMode: entry.paymentMode || "",
    invoiceNumber: entry.invoiceId || "",
    remarks: entry.remarks || "",
    project: entry.project || "",
  });

  useEffect(() => {
    if (!open) return;
    setDate(entry.date ? new Date(entry.date) : undefined);
    setForm({
      source: entry.source || "",
      amount: entry.amount ? String(entry.amount) : "",
      paymentMode: entry.paymentMode || "",
      invoiceNumber: entry.invoiceId || "",
      remarks: entry.remarks || "",
      project: entry.project || "",
    });
  }, [open, entry]);

  async function submit() {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        date: format(date, "yyyy-MM-dd"),
        source: form.source,
        amount: parseFloat(form.amount),
        paymentMode: form.paymentMode,
      };
      if (form.project) payload.project = form.project;
      if (form.invoiceNumber) payload.invoiceId = form.invoiceNumber;
      if (form.remarks) payload.remarks = form.remarks;

      const res = await fetch(`/api/income/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update income");
      }

      toast.success("Income updated successfully!");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating income:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update income");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Income"
      description="Update income details"
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
            <Label htmlFor="date">Date</Label>
            <DatePicker date={date} onDateChange={setDate} placeholder="Select date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Income Source</Label>
            <Select value={form.source} onValueChange={(value) => setForm({ ...form, source: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select income source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Project Payment">Project Payment</SelectItem>
                <SelectItem value="Service Fee">Service Fee</SelectItem>
                <SelectItem value="Consulting">Consulting</SelectItem>
                <SelectItem value="Product Sales">Product Sales</SelectItem>
                <SelectItem value="Subscription">Subscription</SelectItem>
                <SelectItem value="Grant">Grant</SelectItem>
                <SelectItem value="Investment">Investment</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
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
            <Label htmlFor="paymentMode">Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={(value) => setForm({ ...form, paymentMode: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Credit Card">Credit Card</SelectItem>
                <SelectItem value="Debit Card">Debit Card</SelectItem>
                <SelectItem value="Check">Check</SelectItem>
                <SelectItem value="Mobile Payment">Mobile Payment</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number (Optional)</Label>
            <Input
              id="invoiceNumber"
              placeholder="INV-001"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="project">Project (Optional)</Label>
            <ProjectAutoComplete
              value={form.project}
              onChange={(value) => setForm({ ...form, project: value })}
              placeholder="Select project"
              refreshKey={projectRefreshKey}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProjectDialogOpen(true)}
              className="mt-2"
            >
              Create Project
            </Button>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="remarks">Remarks (Optional)</Label>
            <Input
              id="remarks"
              placeholder="Additional notes"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
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
