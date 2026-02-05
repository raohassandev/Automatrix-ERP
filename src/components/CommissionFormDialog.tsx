"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };

type Commission = {
  id: string;
  employeeId: string;
  projectRef?: string | null;
  basisType?: string | null;
  basisAmount?: number | string | null;
  percent?: number | string | null;
  amount?: number | string;
  reason?: string | null;
  status?: string | null;
};

export function CommissionFormDialog({
  open,
  onOpenChange,
  employees,
  commission,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  commission?: Commission | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    employeeId: "",
    projectRef: "",
    basisType: "SALES",
    basisAmount: "",
    percent: "",
    amount: "",
    reason: "",
  });

  useEffect(() => {
    if (open) {
      if (commission) {
        setForm({
          employeeId: commission.employeeId || "",
          projectRef: commission.projectRef || "",
          basisType: commission.basisType || "SALES",
          basisAmount: commission.basisAmount !== null && commission.basisAmount !== undefined ? String(commission.basisAmount) : "",
          percent: commission.percent !== null && commission.percent !== undefined ? String(commission.percent) : "",
          amount: commission.amount !== null && commission.amount !== undefined ? String(commission.amount) : "",
          reason: commission.reason || "",
        });
      } else {
        setForm({
          employeeId: employees[0]?.id || "",
          projectRef: "",
          basisType: "SALES",
          basisAmount: "",
          percent: "",
          amount: "",
          reason: "",
        });
      }
    }
  }, [open, commission, employees]);

  async function submit() {
    if (!form.employeeId || !form.projectRef) {
      toast.error("Employee and project are required");
      return;
    }

    const basisAmount = form.basisAmount ? Number(form.basisAmount) : undefined;
    const percent = form.percent ? Number(form.percent) : undefined;
    const amount =
      form.amount
        ? Number(form.amount)
        : basisAmount !== undefined && percent !== undefined
          ? (basisAmount * percent) / 100
          : undefined;

    if (amount === undefined || Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter amount or provide percent + basis amount");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      projectRef: form.projectRef || undefined,
      basisType: form.basisType || undefined,
      basisAmount: basisAmount,
      percent: percent,
      amount,
      reason: form.reason || undefined,
    };
    const url = commission ? `/api/commissions/${commission.id}` : "/api/commissions";
    const method = commission ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save commission");
      return;
    }
    toast.success(commission ? "Commission updated" : "Commission created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={commission ? "Edit Commission" : "Add Commission"}
      description="Record sales commissions and deductions."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="employee">Employee</Label>
          <select
            id="employee"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.email})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectRef">Project</Label>
          <Input
            id="projectRef"
            value={form.projectRef}
            onChange={(e) => setForm({ ...form, projectRef: e.target.value })}
            placeholder="Project ID or name"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="basisType">Basis Type</Label>
            <select
              id="basisType"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.basisType}
              onChange={(e) => setForm({ ...form, basisType: e.target.value })}
            >
              <option value="SALES">Sales</option>
              <option value="PROFIT">Profit</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="basisAmount">Basis Amount</Label>
            <Input
              id="basisAmount"
              type="number"
              value={form.basisAmount}
              onChange={(e) => setForm({ ...form, basisAmount: e.target.value })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="percent">Percent %</Label>
            <Input
              id="percent"
              type="number"
              value={form.percent}
              onChange={(e) => setForm({ ...form, percent: e.target.value })}
              min={0}
              step="0.01"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (PKR)</Label>
          <Input
            id="amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            min={0}
            placeholder="Auto-calculated if basis is provided"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Commission adjustment notes"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : commission ? "Save Changes" : "Create Commission"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
