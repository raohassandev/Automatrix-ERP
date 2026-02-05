"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };

type Incentive = {
  id: string;
  employeeId: string;
  projectRef?: string | null;
  amount: number | string;
  reason?: string | null;
  status?: string | null;
};

type IncentiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  incentive?: Incentive | null;
};

const buildInitialForm = (incentive: Incentive | null | undefined, employees: EmployeeOption[]) => ({
  employeeId: incentive?.employeeId || employees[0]?.id || "",
  projectRef: incentive?.projectRef || "",
  amount: incentive?.amount !== null && incentive?.amount !== undefined ? String(incentive.amount) : "",
  reason: incentive?.reason || "",
});

export function IncentiveFormDialog(props: IncentiveFormDialogProps) {
  const key = `${props.open ? "open" : "closed"}-${props.incentive?.id || "new"}`;
  return <IncentiveFormDialogInner key={key} {...props} />;
}

function IncentiveFormDialogInner({
  open,
  onOpenChange,
  employees,
  incentive,
}: IncentiveFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => buildInitialForm(incentive, employees));

  async function submit() {
    if (!form.employeeId || !form.amount || !form.projectRef) {
      toast.error("Employee, project, and amount are required");
      return;
    }
    const payload = {
      employeeId: form.employeeId,
      projectRef: form.projectRef || undefined,
      amount: Number(form.amount),
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
      description="Record project incentives and adjustments."
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
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Quality deduction, milestone bonus, etc."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
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
