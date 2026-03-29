"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EmployeeCompensationDialogProps = {
  employeeId: string;
  employeeName: string;
  baseSalary?: number | null;
  currency?: string | null;
  effectiveFrom?: string | null;
  notes?: string | null;
  canEdit: boolean;
};

export function EmployeeCompensationDialog({
  employeeId,
  employeeName,
  baseSalary,
  currency,
  effectiveFrom,
  notes,
  canEdit,
}: EmployeeCompensationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initialForm = useMemo(
    () => ({
      baseSalary: baseSalary && Number(baseSalary) > 0 ? String(baseSalary) : "",
      currency: (currency || "PKR").toUpperCase(),
      effectiveFrom: effectiveFrom || "",
      notes: notes || "",
    }),
    [baseSalary, currency, effectiveFrom, notes],
  );

  const [form, setForm] = useState(initialForm);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm(initialForm);
    }
  }

  async function submit() {
    const salary = Number(form.baseSalary);
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error("Base salary must be a valid non-negative number.");
      return;
    }

    const res = await fetch(`/api/employees/${employeeId}/compensation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseSalary: salary,
        currency: (form.currency || "PKR").trim().toUpperCase(),
        effectiveFrom: form.effectiveFrom || null,
        notes: form.notes || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save compensation.");
      return;
    }

    toast.success("Employee salary profile updated.");
    setOpen(false);
    router.refresh();
  }

  if (!canEdit) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => handleOpenChange(true)}>
        Set Base Salary
      </Button>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={`Compensation: ${employeeName}`}
        description="This base salary is used as payroll default."
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
              <Label htmlFor="baseSalary">Base Salary</Label>
              <Input
                id="baseSalary"
                type="number"
                min={0}
                step="0.01"
                value={form.baseSalary}
                onChange={(e) => setForm((prev) => ({ ...prev, baseSalary: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency}
                maxLength={8}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="effectiveFrom">Effective From</Label>
              <DateField
                id="effectiveFrom"
                value={form.effectiveFrom}
                onChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Contract terms, salary revision notes, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Compensation"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
