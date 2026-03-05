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
import CategoryAutoComplete from "./CategoryAutoComplete";
import ProjectAutoComplete from "./ProjectAutoComplete";
import PaymentModeAutoComplete from "./PaymentModeAutoComplete";
import { Textarea } from "./ui/textarea";

type ExpenseEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: {
    id: string;
    date: string | Date;
    description: string;
    category: string;
    amount: number;
    paymentMode: string;
    paymentSource?: string | null;
    companyAccountId?: string | null;
    expenseType?: string | null;
    project?: string | null;
    remarks?: string | null;
    categoryRequest?: string | null;
    receiptUrl?: string | null;
    receiptFileId?: string | null;
  };
};

export function ExpenseEditDialog({ open, onOpenChange, expense }: ExpenseEditDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [date, setDate] = useState<Date | undefined>(
    expense.date ? new Date(expense.date) : undefined
  );
  const [form, setForm] = useState({
    description: expense.description || "",
    category: expense.category || "",
    amount: expense.amount ? String(expense.amount) : "",
    paymentMode: expense.paymentMode || "",
    paymentSource: expense.paymentSource || "COMPANY_DIRECT",
    companyAccountId: expense.companyAccountId || "",
    expenseType: expense.expenseType || "COMPANY",
    project: expense.project || "",
    receiptUrl: expense.receiptUrl || "",
    receiptFileId: expense.receiptFileId || "",
    remarks: expense.remarks || "",
    categoryRequest: expense.categoryRequest || "",
  });

  useEffect(() => {
    if (open) {
      setDate(expense.date ? new Date(expense.date) : undefined);
      setForm({
        description: expense.description || "",
        category: expense.category || "",
        amount: expense.amount ? String(expense.amount) : "",
        paymentMode: expense.paymentMode || "",
        paymentSource: expense.paymentSource || "COMPANY_DIRECT",
        companyAccountId: expense.companyAccountId || "",
        expenseType: expense.expenseType || "COMPANY",
        project: expense.project || "",
        receiptUrl: expense.receiptUrl || "",
        receiptFileId: expense.receiptFileId || "",
        remarks: expense.remarks || "",
        categoryRequest: expense.categoryRequest || "",
      });
    }
  }, [open, expense]);

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
    if (form.paymentSource === "COMPANY_ACCOUNT" && !form.companyAccountId) {
      toast.error("Please select a company account");
      return;
    }

    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          description: form.description,
          category: form.category,
          amount: parseFloat(form.amount),
          paymentMode: form.paymentMode,
          paymentSource: form.paymentSource,
          companyAccountId: form.paymentSource === "COMPANY_ACCOUNT" ? form.companyAccountId : undefined,
          expenseType: form.expenseType,
          project: form.project || null,
          receiptUrl: form.receiptUrl || undefined,
          receiptFileId: form.receiptFileId || undefined,
          remarks: form.remarks || undefined,
          categoryRequest: form.categoryRequest || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update expense");
      }

      toast.success("Expense updated successfully!");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update expense");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Expense"
      description="Update expense details"
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
            <Label htmlFor="category">Category</Label>
            <CategoryAutoComplete
              type="expense"
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
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
            <Label htmlFor="paymentMode">Payment Mode</Label>
            <PaymentModeAutoComplete
              value={form.paymentMode}
              onChange={(value) => setForm({ ...form, paymentMode: value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentSource">Payment Source</Label>
            <Select
              value={form.paymentSource}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  paymentSource: value,
                  companyAccountId: value === "COMPANY_ACCOUNT" ? prev.companyAccountId : "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY_DIRECT">Company Direct</SelectItem>
                <SelectItem value="COMPANY_ACCOUNT">Company Account</SelectItem>
                <SelectItem value="EMPLOYEE_POCKET">Employee Own Pocket (Reimburse)</SelectItem>
                <SelectItem value="EMPLOYEE_WALLET">Employee Wallet</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {form.paymentSource === "EMPLOYEE_WALLET"
                ? "Advance-funded expense. It will not be reimbursed again."
                : form.paymentSource === "EMPLOYEE_POCKET"
                ? "Own-pocket expense. It becomes payable after approval and then reimbursed."
                : "Company-paid expense source."}
            </div>
          </div>

          {form.paymentSource === "COMPANY_ACCOUNT" ? (
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
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="expenseType">Expense Type</Label>
            <Select
              value={form.expenseType}
              onValueChange={(value) => setForm({ ...form, expenseType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Company Expense</SelectItem>
                <SelectItem value="OWNER_PERSONAL">Owner Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <ProjectAutoComplete
              value={form.project}
              onChange={(value) => setForm({ ...form, project: value })}
              placeholder={form.expenseType === "OWNER_PERSONAL" ? "Personal expense (no project)" : "Select project"}
              disabled={form.expenseType === "OWNER_PERSONAL"}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="remarks">Remarks (Optional)</Label>
            <Textarea
              id="remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="categoryRequest">Request New Category (Optional)</Label>
            <Input
              id="categoryRequest"
              value={form.categoryRequest}
              onChange={(e) => setForm({ ...form, categoryRequest: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiptUrl">Receipt URL (Optional)</Label>
            <Input
              id="receiptUrl"
              value={form.receiptUrl}
              onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiptFileId">Receipt File ID (Optional)</Label>
            <Input
              id="receiptFileId"
              value={form.receiptFileId}
              onChange={(e) => setForm({ ...form, receiptFileId: e.target.value })}
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
    </FormDialog>
  );
}
