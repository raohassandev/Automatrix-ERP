"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };

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

const emptyEntry = (employeeId?: string): PayrollEntry => ({
  employeeId: employeeId || "",
  baseSalary: "",
  incentiveTotal: "",
  deductions: "",
  deductionReason: "",
});

export function PayrollRunFormDialog({
  open,
  onOpenChange,
  employees,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  run?: PayrollRun | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [entries, setEntries] = useState<PayrollEntry[]>([emptyEntry(employees[0]?.id)]);

  useEffect(() => {
    if (open) {
      if (run) {
        setForm({
          periodStart: run.periodStart?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          periodEnd: run.periodEnd?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          notes: run.notes || "",
        });
                setEntries(
                  run.entries?.length
                    ? run.entries.map((entry) => ({
                        employeeId: entry.employeeId,
                        baseSalary: String(entry.baseSalary || ""),
                        incentiveTotal: String(entry.incentiveTotal || ""),
                        deductions: String(entry.deductions || ""),
                        deductionReason: String((entry as PayrollEntry).deductionReason || ""),
                      }))
                    : [emptyEntry(employees[0]?.id)]
                );
      } else {
        setForm({
          periodStart: new Date().toISOString().slice(0, 10),
          periodEnd: new Date().toISOString().slice(0, 10),
          notes: "",
        });
        setEntries([emptyEntry(employees[0]?.id)]);
      }
    }
  }, [open, run, employees]);

  const updateEntry = (index: number, key: keyof PayrollEntry, value: string) => {
    setEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, [key]: value } : entry)));
  };

  const addEntry = () => setEntries((prev) => [...prev, emptyEntry(employees[0]?.id)]);
  const removeEntry = (index: number) => setEntries((prev) => prev.filter((_, idx) => idx !== index));

  async function submit() {
    const cleaned = entries
      .map((entry) => ({
        employeeId: entry.employeeId,
        baseSalary: Number(entry.baseSalary),
        incentiveTotal: Number(entry.incentiveTotal || 0),
        deductions: Number(entry.deductions || 0),
        deductionReason: entry.deductionReason || undefined,
      }))
      .filter((entry) => entry.employeeId && entry.baseSalary >= 0);

    if (!form.periodStart || !form.periodEnd || cleaned.length === 0) {
      toast.error("Period and at least one entry are required");
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

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={run ? "Edit Payroll Run" : "Create Payroll Run"}
      description="Build a pay period and approve to credit wallets."
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
            <Button type="button" variant="outline" onClick={addEntry}>
              Add Entry
            </Button>
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
                        {employee.name} ({employee.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Base Salary</Label>
                  <Input
                    type="number"
                    value={entry.baseSalary}
                    onChange={(e) => updateEntry(index, "baseSalary", e.target.value)}
                    min={0}
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
