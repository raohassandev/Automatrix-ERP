"use client";

import { useState, useTransition } from "react";
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
}

export function EmployeeWalletDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  currentBalance,
}: EmployeeWalletDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: "CREDIT",
    amount: "",
    reason: "",
  });

  async function submit() {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
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
