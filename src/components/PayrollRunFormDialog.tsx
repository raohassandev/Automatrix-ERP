"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { employeeDisplayLabel } from "@/lib/employee-display";

type EmployeeOption = { id: string; name: string; email: string; baseSalary?: number };

type PayrollEntry = {
  employeeId: string;
  baseSalary: number | string;
  incentiveTotal: number | string;
  deductions: number | string;
  deductionReason?: string;
};

type PayrollRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status?: string | null;
  notes?: string | null;
  entries: PayrollEntry[];
};

function defaultPreviousMonthRange() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

const emptyEntry = (employeeId?: string): PayrollEntry => ({
  employeeId: employeeId || "",
  baseSalary: "",
  incentiveTotal: "",
  deductions: "",
  deductionReason: "",
});

type PayrollRunFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  run?: PayrollRun | null;
};

const buildInitialForm = (run: PayrollRun | null | undefined) => ({
  periodStart: run?.periodStart?.slice(0, 10) || defaultPreviousMonthRange().start,
  periodEnd: run?.periodEnd?.slice(0, 10) || defaultPreviousMonthRange().end,
  notes: run?.notes || "",
});

const buildInitialEntries = (run: PayrollRun | null | undefined, employees: EmployeeOption[]) =>
  run?.entries?.length
    ? run.entries.map((entry) => ({
        employeeId: entry.employeeId,
        baseSalary: String(entry.baseSalary || ""),
        incentiveTotal: String(entry.incentiveTotal || ""),
        deductions: String(entry.deductions || ""),
        deductionReason: String(entry.deductionReason || ""),
      }))
    : [
        {
          ...emptyEntry(employees[0]?.id),
          baseSalary:
            employees[0] && Number(employees[0].baseSalary || 0) > 0
              ? String(Number(employees[0].baseSalary || 0))
              : "",
        },
      ];

export function PayrollRunFormDialog(props: PayrollRunFormDialogProps) {
  const key = `${props.open ? "open" : "closed"}-${props.run?.id || "new"}`;
  return <PayrollRunFormDialogInner key={key} {...props} />;
}

function PayrollRunFormDialogInner({
  open,
  onOpenChange,
  employees,
  run,
}: PayrollRunFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [policyLoading, setPolicyLoading] = useState(false);
  const [lockProfileBaseSalary, setLockProfileBaseSalary] = useState(true);
  const [form, setForm] = useState(() => buildInitialForm(run));
  const [entries, setEntries] = useState<PayrollEntry[]>(() => buildInitialEntries(run, employees));
  const salaryByEmployeeId = new Map(employees.map((e) => [e.id, Number(e.baseSalary || 0)]));

  const updateEntry = (index: number, key: keyof PayrollEntry, value: string) => {
    setEntries((prev) =>
      prev.map((entry, idx) => {
        if (idx !== index) return entry;
        if (key === "employeeId") {
          const pickedSalary = salaryByEmployeeId.get(value) || 0;
          const existingSalary = Number(entry.baseSalary || 0);
          return {
            ...entry,
            employeeId: value,
            baseSalary: lockProfileBaseSalary
              ? String(pickedSalary || 0)
              : existingSalary > 0
              ? entry.baseSalary
              : pickedSalary > 0
              ? String(pickedSalary)
              : entry.baseSalary,
          };
        }
        if (lockProfileBaseSalary && key === "baseSalary") {
          return entry;
        }
        return { ...entry, [key]: value };
      }),
    );
  };

  const addEntry = () =>
    setEntries((prev) => {
      const employeeId = employees[0]?.id;
      const firstSalary = employeeId ? Number(salaryByEmployeeId.get(employeeId) || 0) : 0;
      return [
        ...prev,
        {
          ...emptyEntry(employeeId),
          baseSalary: firstSalary > 0 ? String(firstSalary) : "",
        },
      ];
    });
  const removeEntry = (index: number) => setEntries((prev) => prev.filter((_, idx) => idx !== index));

  async function submit() {
    if (!form.periodStart || !form.periodEnd) {
      toast.error("Payroll period start and end are required.");
      return;
    }
    if (new Date(form.periodEnd) < new Date(form.periodStart)) {
      toast.error("Period end cannot be earlier than period start.");
      return;
    }
    const cleaned = entries
      .map((entry) => ({
        employeeId: entry.employeeId,
        baseSalary: lockProfileBaseSalary
          ? Number(salaryByEmployeeId.get(entry.employeeId) || 0)
          : Number(entry.baseSalary),
        incentiveTotal: Number(entry.incentiveTotal || 0),
        deductions: Number(entry.deductions || 0),
        deductionReason: entry.deductionReason || undefined,
      }))
      .filter((entry) => entry.employeeId && entry.baseSalary >= 0);

    if (cleaned.length === 0) {
      toast.error("Add at least one valid payroll entry.");
      return;
    }
    const seen = new Set<string>();
    for (const row of cleaned) {
      if (seen.has(row.employeeId)) {
        toast.error("Duplicate employee rows are not allowed in the same payroll run.");
        return;
      }
      seen.add(row.employeeId);
    }
    const invalidNumbers = cleaned.some(
      (entry) =>
        !Number.isFinite(entry.baseSalary) ||
        !Number.isFinite(entry.incentiveTotal) ||
        !Number.isFinite(entry.deductions) ||
        entry.baseSalary < 0 ||
        entry.incentiveTotal < 0 ||
        entry.deductions < 0,
    );
    if (invalidNumbers) {
      toast.error("Salary, incentive, and deduction values must be valid non-negative numbers.");
      return;
    }
    const missingDeductionReason = cleaned.some(
      (entry) => entry.deductions > 0 && !(entry.deductionReason || "").trim(),
    );
    if (missingDeductionReason) {
      toast.error("Deduction reason is required when deduction amount is greater than zero.");
      return;
    }

    const payload = {
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      notes: form.notes || undefined,
      entries: cleaned,
    };

    const url = run ? `/api/payroll/runs/${run.id}` : "/api/payroll/runs";
    const method = run ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save payroll run");
      return;
    }

    toast.success(run ? "Payroll run updated" : "Payroll run created");
    onOpenChange(false);
    router.refresh();
  }

  async function loadFromPolicy() {
    if (!form.periodStart || !form.periodEnd) {
      toast.error("Set payroll period first.");
      return;
    }
    setPolicyLoading(true);
    try {
      const params = new URLSearchParams({
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      });
      const res = await fetch(`/api/payroll/runs/policy-preview?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load policy entries.");
        return;
      }
      const nextEntries = Array.isArray(data.data)
        ? data.data.map((entry: PayrollEntry) => ({
            employeeId: entry.employeeId,
            baseSalary: String(entry.baseSalary || ""),
            incentiveTotal: String(entry.incentiveTotal || 0),
            deductions: String(entry.deductions || 0),
            deductionReason: String(entry.deductionReason || ""),
          }))
        : [];
      if (nextEntries.length === 0) {
        toast.error("No active employees or compensation data found for policy generation.");
        return;
      }
      setEntries(nextEntries);
      toast.success(`Loaded ${nextEntries.length} entries from payroll policy.`);
    } finally {
      setPolicyLoading(false);
    }
  }

  function fillBaseSalariesFromProfile() {
    setEntries((prev) =>
      prev.map((entry) => {
        const current = Number(entry.baseSalary || 0);
        if (current > 0) return entry;
        const fallback = Number(salaryByEmployeeId.get(entry.employeeId) || 0);
        return {
          ...entry,
          baseSalary: fallback > 0 ? String(fallback) : entry.baseSalary,
        };
      }),
    );
    toast.success("Base salaries filled from employee compensation profile.");
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={run ? "Edit Payroll Run" : "Create Payroll Run"}
      description="Create pay period entries, review totals, then approve to post payroll."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Keep one employee per row. Default period is previous month only. If deductions are entered, write the reason for audit clarity.
        </div>
        <div className="flex items-center justify-between rounded-md border border-emerald-200/50 bg-emerald-50/50 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div>
            Base salary source: <span className="font-semibold">Employee compensation profile</span>
            {lockProfileBaseSalary ? " (locked)" : " (manual override enabled)"}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lockProfileBaseSalary}
              onChange={(e) => {
                const checked = e.target.checked;
                setLockProfileBaseSalary(checked);
                if (checked) {
                  setEntries((prev) =>
                    prev.map((entry) => ({
                      ...entry,
                      baseSalary: String(Number(salaryByEmployeeId.get(entry.employeeId) || 0)),
                    })),
                  );
                }
              }}
            />
            Lock profile base salary
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="periodStart">Period Start</Label>
            <Input
              id="periodStart"
              type="date"
              value={form.periodStart}
              onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodEnd">Period End</Label>
            <Input
              id="periodEnd"
              type="date"
              value={form.periodEnd}
              onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Entries</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={loadFromPolicy} disabled={policyLoading || pending}>
                {policyLoading ? "Loading..." : "Auto-fill by Policy"}
              </Button>
              <Button type="button" variant="outline" onClick={fillBaseSalariesFromProfile} disabled={pending}>
                Fill Base Salary
              </Button>
              <Button type="button" variant="outline" onClick={addEntry}>
                Add Entry
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2">
                  <Label>Employee</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                    value={entry.employeeId}
                    onChange={(e) => updateEntry(index, "employeeId", e.target.value)}
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeDisplayLabel(employee)}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-muted-foreground">
                    Profile salary:{" "}
                    {Number(salaryByEmployeeId.get(entry.employeeId) || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Base Salary</Label>
                  <Input
                    type="number"
                    value={entry.baseSalary}
                    onChange={(e) => updateEntry(index, "baseSalary", e.target.value)}
                    min={0}
                    disabled={lockProfileBaseSalary}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Incentive</Label>
                  <Input
                    type="number"
                    value={entry.incentiveTotal}
                    onChange={(e) => updateEntry(index, "incentiveTotal", e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Deductions</Label>
                  <Input
                    type="number"
                    value={entry.deductions}
                    onChange={(e) => updateEntry(index, "deductions", e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Deduction Reason</Label>
                  <Input
                    value={entry.deductionReason}
                    onChange={(e) => updateEntry(index, "deductionReason", e.target.value)}
                    placeholder="Required if deductions applied"
                  />
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2 text-xs text-emerald-800 md:col-span-4">
                  Estimated Net Pay:{" "}
                  {(
                    Number(entry.baseSalary || 0) +
                    Number(entry.incentiveTotal || 0) -
                    Number(entry.deductions || 0)
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                {entries.length > 1 ? (
                  <div className="md:col-span-4">
                    <Button type="button" variant="ghost" onClick={() => removeEntry(index)}>
                      Remove Entry
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : run ? "Save Changes" : "Create Run"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
