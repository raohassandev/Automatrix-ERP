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

interface IncomeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncomeFormDialog({ open, onOpenChange }: IncomeFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState<Date>();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [form, setForm] = useState({
    source: "",
    amount: "",
    paymentMode: "",
    companyAccountId: "",
    invoiceNumber: "",
    remarks: "",
    project: "",
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/company-accounts")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        const active = list.filter((a: { isActive?: boolean }) => a.isActive !== false);
        setAccounts(active);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit() {
    if (!date) {
      toast.error("Please select a date");
      return;
    }
    if (!form.companyAccountId) {
      toast.error("Please select a company account");
      return;
    }

    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          source: form.source,
          amount: parseFloat(form.amount),
          paymentMode: form.paymentMode,
          companyAccountId: form.companyAccountId,
          project: form.project || undefined,
          invoiceId: form.invoiceNumber || null,
          remarks: form.remarks || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to log income");
      }

      toast.success("Income logged successfully!");
      
      // Reset form
      setDate(undefined);
      setForm({
        source: "",
        amount: "",
        paymentMode: "",
        companyAccountId: "",
        invoiceNumber: "",
        remarks: "",
        project: "",
      });
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error logging income:", error);
      toast.error(error instanceof Error ? error.message : "Failed to log income");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log Income"
      description="Record income received by the organization"
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
            <DatePicker
              date={date}
              onDateChange={setDate}
              placeholder="Select date"
            />
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
            <Label htmlFor="companyAccountId">Company Account</Label>
            <Select
              value={form.companyAccountId}
              onValueChange={(value) => setForm({ ...form, companyAccountId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cash/bank account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </SelectItem>
                ))}
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
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Logging..." : "Log Income"}
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
