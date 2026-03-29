"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { employeeCodeFromId } from "@/lib/employee-display";

type EmployeeOption = { id: string; name: string; email: string };

type Incentive = {
  id: string;
  employeeId: string;
  projectRef?: string | null;
  earningDate?: string | null;
  scheduledPayrollMonth?: string | null;
  dueDate?: string | null;
  formulaType?: string | null;
  basisAmount?: number | string | null;
  percent?: number | string | null;
  payoutMode?: string | null;
  amount: number | string;
  reason?: string | null;
  status?: string | null;
};

type IncentiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  incentive?: Incentive | null;
  defaultProjectRef?: string;
  lockProjectRef?: boolean;
};

const buildInitialForm = (
  incentive: Incentive | null | undefined,
  employees: EmployeeOption[],
  defaultProjectRef?: string,
) => {
  const today = new Date().toISOString().slice(0, 10);
  const earningDate = incentive?.earningDate ? String(incentive.earningDate).slice(0, 10) : today;
  const scheduledPayrollMonthDefault = `${earningDate.slice(0, 4)}-${earningDate.slice(5, 7)}`;
  return {
  employeeId: incentive?.employeeId || employees[0]?.id || "",
  projectRef: incentive?.projectRef || defaultProjectRef || "",
  earningDate,
  scheduledPayrollMonth: incentive?.scheduledPayrollMonth || scheduledPayrollMonthDefault,
  dueDate: incentive?.dueDate ? String(incentive.dueDate).slice(0, 10) : "",
  formulaType: incentive?.formulaType || "FIXED",
  basisAmount:
    incentive?.basisAmount !== null && incentive?.basisAmount !== undefined
      ? String(incentive.basisAmount)
      : "",
  percent:
    incentive?.percent !== null && incentive?.percent !== undefined
      ? String(incentive.percent)
      : "",
  payoutMode: incentive?.payoutMode || "PAYROLL",
  amount: incentive?.amount !== null && incentive?.amount !== undefined ? String(incentive.amount) : "",
  reason: incentive?.reason || "",
  };
};

export function IncentiveFormDialog(props: IncentiveFormDialogProps) {
  const key = `${props.open ? "open" : "closed"}-${props.incentive?.id || "new"}`;
  return <IncentiveFormDialogInner key={key} {...props} />;
}

function IncentiveFormDialogInner({
  open,
  onOpenChange,
  employees,
  incentive,
  defaultProjectRef,
  lockProjectRef,
}: IncentiveFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => buildInitialForm(incentive, employees, defaultProjectRef));

  async function submit() {
    if (!form.employeeId || !form.projectRef) {
      toast.error("Employee and project are required");
      return;
    }

    const amount = form.amount ? Number(form.amount) : undefined;
    const basisAmount = form.basisAmount ? Number(form.basisAmount) : undefined;
    const percent = form.percent ? Number(form.percent) : undefined;

    if ((amount === undefined || Number.isNaN(amount) || amount <= 0) && !(percent && percent > 0)) {
      toast.error("Enter amount or percentage formula");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      projectRef: form.projectRef || undefined,
      earningDate: form.earningDate || undefined,
      scheduledPayrollMonth: form.payoutMode === "PAYROLL" ? form.scheduledPayrollMonth || undefined : undefined,
      dueDate: form.payoutMode === "WALLET" ? form.dueDate || undefined : undefined,
      formulaType: form.formulaType,
      basisAmount,
      percent,
      payoutMode: form.payoutMode,
      amount,
      reason: form.reason || undefined,
    };
    const url = incentive ? `/api/incentives/${incentive.id}` : "/api/incentives";
    const method = incentive ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save incentive");
      return;
    }
    toast.success(incentive ? "Incentive updated" : "Incentive created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={incentive ? "Edit Incentive" : "Add Incentive"}
      description="Record employee incentives with fixed or percentage formula; payroll payout is default."
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
            <Label htmlFor="employee">Employee</Label>
            <select
              id="employee"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeCodeFromId(employee.id)} - {employee.name}
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
              disabled={Boolean(lockProjectRef)}
            />
            {lockProjectRef ? (
              <div className="text-xs text-muted-foreground">Project is locked from project detail context.</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="formulaType">Formula</Label>
            <select
              id="formulaType"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.formulaType}
              onChange={(e) => setForm({ ...form, formulaType: e.target.value })}
            >
              <option value="FIXED">Fixed Amount</option>
              <option value="PERCENT_PROFIT">% of Project Profit</option>
              <option value="PERCENT_AMOUNT">% of Amount</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payoutMode">Payout Mode</Label>
            <select
              id="payoutMode"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.payoutMode}
              onChange={(e) => setForm({ ...form, payoutMode: e.target.value })}
            >
              <option value="PAYROLL">Upcoming Payroll</option>
              <option value="WALLET">Direct Wallet</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="earningDate">Earning Date</Label>
            <DateField
              id="earningDate"
              value={form.earningDate}
              onChange={(value) => {
                const nextMonth = value && value.length >= 7 ? `${value.slice(0, 4)}-${value.slice(5, 7)}` : "";
                setForm((prev) => ({
                  ...prev,
                  earningDate: value,
                  scheduledPayrollMonth:
                    prev.payoutMode === "PAYROLL" && !prev.scheduledPayrollMonth ? nextMonth : prev.scheduledPayrollMonth,
                }));
              }}
            />
          </div>

          {form.payoutMode === "PAYROLL" ? (
            <div className="space-y-2">
              <Label htmlFor="scheduledPayrollMonth">Payroll Month</Label>
              <Input
                id="scheduledPayrollMonth"
                type="month"
                value={form.scheduledPayrollMonth}
                onChange={(e) => setForm({ ...form, scheduledPayrollMonth: e.target.value })}
              />
              <div className="text-xs text-muted-foreground">
                Incentive will be due in this payroll month.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dueDate">Wallet Due Date</Label>
              <DateField
                id="dueDate"
                value={form.dueDate}
                onChange={(value) => setForm({ ...form, dueDate: value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="basisAmount">Basis Amount</Label>
            <Input
              id="basisAmount"
              type="number"
              value={form.basisAmount}
              onChange={(e) => setForm({ ...form, basisAmount: e.target.value })}
              min={0}
              placeholder={form.formulaType === "PERCENT_PROFIT" ? "Optional (auto from project)" : "Amount basis"}
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

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="amount">Amount (PKR)</Label>
            <Input
              id="amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              min={0}
              placeholder="Optional if formula is used"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Milestone completion, quality bonus, etc."
          />
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Payroll payout keeps incentive visible in salary slip with clear project trace. Use wallet payout only for exceptional immediate settlement.
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : incentive ? "Save Changes" : "Create Incentive"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
