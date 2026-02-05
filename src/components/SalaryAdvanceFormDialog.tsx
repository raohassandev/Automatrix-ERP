"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };

type SalaryAdvance = {
  id: string;
  employeeId: string;
  amount: number | string;
  reason: string;
  status?: string | null;
};

export function SalaryAdvanceFormDialog({
  open,
  onOpenChange,
  employees,
  advance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  advance?: SalaryAdvance | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    employeeId: "",
    amount: "",
    reason: "",
  });

  useEffect(() => {
    if (open) {
      if (advance) {
        setForm({
          employeeId: advance.employeeId || "",
          amount: String(advance.amount ?? ""),
          reason: advance.reason || "",
        });
      } else {
        setForm({
          employeeId: employees[0]?.id || "",
          amount: "",
          reason: "",
        });
      }
    }
  }, [open, advance, employees]);

  async function submit() {
    if (!form.employeeId || !form.amount || !form.reason) {
      toast.error("Employee, amount, and reason are required");
      return;
    }
    const payload = {
      employeeId: form.employeeId,
      amount: Number(form.amount),
      reason: form.reason,
    };
    const url = advance ? `/api/salary-advances/${advance.id}` : "/api/salary-advances";
    const method = advance ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save advance");
      return;
    }
    toast.success(advance ? "Advance updated" : "Advance requested");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={advance ? "Edit Salary Advance" : "Request Salary Advance"}
      description="Record salary advances with justification."
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
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            min={0}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason / Justification</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Advance request reason"
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : advance ? "Save Changes" : "Submit"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
