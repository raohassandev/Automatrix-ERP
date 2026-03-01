"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

interface EmployeeWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  currentBalance: number;
  availableBalance?: number;
}

export function EmployeeWalletDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  currentBalance,
  availableBalance,
}: EmployeeWalletDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [form, setForm] = useState({
    type: "CREDIT",
    amount: "",
    reason: "",
    companyAccountId: "",
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
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (form.type === "CREDIT" && !form.companyAccountId) {
      toast.error("Please select a company account for wallet top-up");
      return;
    }

    try {
      const res = await fetch("/api/employees/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employeeId,
          type: form.type,
          amount: parseFloat(form.amount),
          reference: form.reason,
          companyAccountId: form.companyAccountId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update wallet");
      }

      toast.success(`Wallet ${form.type.toLowerCase()}ed successfully!`);
      
      // Reset form
      setForm({
        type: "CREDIT",
        amount: "",
        reason: "",
        companyAccountId: "",
      });
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error updating wallet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update wallet");
    }
  }

  const newBalance = form.amount 
    ? form.type === "CREDIT"
      ? currentBalance + parseFloat(form.amount)
      : currentBalance - parseFloat(form.amount)
    : currentBalance;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Manage Wallet - ${employeeName}`}
      description="Add or deduct amount from employee wallet"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="rounded-lg bg-muted p-4 mb-4">
          <div className="text-sm text-muted-foreground">Current Balance</div>
          <div className="text-2xl font-bold">{formatMoney(currentBalance)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Available after holds: {formatMoney(availableBalance ?? currentBalance)}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Transaction Type</Label>
          <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CREDIT">Credit (Add Money)</SelectItem>
              <SelectItem value="DEBIT">Debit (Deduct Money)</SelectItem>
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
          <Label htmlFor="companyAccountId">
            Company Account {form.type === "CREDIT" ? "(Required)" : "(Optional)"}
          </Label>
          <Select
            value={form.companyAccountId}
            onValueChange={(value) =>
              setForm({ ...form, companyAccountId: value === "none" ? "" : value })
            }
          >
            <SelectTrigger id="companyAccountId">
              <SelectValue placeholder="Select cash/bank account" />
            </SelectTrigger>
            <SelectContent>
              {form.type !== "CREDIT" ? <SelectItem value="none">None</SelectItem> : null}
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            placeholder="Reason for wallet adjustment"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
          />
        </div>

        {form.amount && (
          <div className="rounded-lg bg-primary/10 p-4">
            <div className="text-sm text-muted-foreground">New Balance</div>
            <div className="text-xl font-bold">{formatMoney(newBalance)}</div>
          </div>
        )}

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
            {pending ? "Processing..." : `${form.type === "CREDIT" ? "Credit" : "Debit"} Wallet`}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
