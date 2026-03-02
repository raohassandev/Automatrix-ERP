"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };
type VendorOption = { id: string; name: string };

type Commission = {
  id: string;
  employeeId?: string | null;
  vendorId?: string | null;
  payeeType?: string | null;
  payoutMode?: string | null;
  projectRef?: string | null;
  basisType?: string | null;
  basisAmount?: number | string | null;
  percent?: number | string | null;
  amount?: number | string;
  reason?: string | null;
  status?: string | null;
};

type CommissionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  vendors: VendorOption[];
  commission?: Commission | null;
};

const buildInitialForm = (
  commission: Commission | null | undefined,
  employees: EmployeeOption[],
  vendors: VendorOption[],
) => {
  const payeeType = commission?.payeeType || "EMPLOYEE";
  const payoutMode =
    commission?.payoutMode || (payeeType === "MIDDLEMAN" ? "AP" : "PAYROLL");

  return {
    payeeType,
    employeeId: commission?.employeeId || employees[0]?.id || "",
    vendorId: commission?.vendorId || vendors[0]?.id || "",
    payoutMode,
    projectRef: commission?.projectRef || "",
    basisType: commission?.basisType || "SALES",
    basisAmount:
      commission?.basisAmount !== null && commission?.basisAmount !== undefined
        ? String(commission.basisAmount)
        : "",
    percent:
      commission?.percent !== null && commission?.percent !== undefined
        ? String(commission.percent)
        : "",
    amount:
      commission?.amount !== null && commission?.amount !== undefined
        ? String(commission.amount)
        : "",
    reason: commission?.reason || "",
  };
};

export function CommissionFormDialog(props: CommissionFormDialogProps) {
  const key = `${props.open ? "open" : "closed"}-${props.commission?.id || "new"}`;
  return <CommissionFormDialogInner key={key} {...props} />;
}

function CommissionFormDialogInner({
  open,
  onOpenChange,
  employees,
  vendors,
  commission,
}: CommissionFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => buildInitialForm(commission, employees, vendors));

  async function submit() {
    if (!form.projectRef) {
      toast.error("Project is required");
      return;
    }

    if (form.payeeType === "EMPLOYEE" && !form.employeeId) {
      toast.error("Employee is required");
      return;
    }

    if (form.payeeType === "MIDDLEMAN" && !form.vendorId) {
      toast.error("Middleman is required");
      return;
    }

    const basisAmount = form.basisAmount ? Number(form.basisAmount) : undefined;
    const percent = form.percent ? Number(form.percent) : undefined;
    const amount = form.amount ? Number(form.amount) : undefined;

    if ((amount === undefined || Number.isNaN(amount) || amount <= 0) && !(basisAmount !== undefined && percent !== undefined)) {
      toast.error("Enter amount or provide percent + basis amount");
      return;
    }

    const payload = {
      payeeType: form.payeeType,
      employeeId: form.payeeType === "EMPLOYEE" ? form.employeeId : undefined,
      vendorId: form.payeeType === "MIDDLEMAN" ? form.vendorId : undefined,
      payoutMode: form.payeeType === "MIDDLEMAN" ? "AP" : form.payoutMode,
      projectRef: form.projectRef || undefined,
      basisType: form.basisType || undefined,
      basisAmount,
      percent,
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
      description="Record employee or middleman commissions with fixed or percentage formula."
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
            <Label htmlFor="payeeType">Payee Type</Label>
            <select
              id="payeeType"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.payeeType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payeeType: e.target.value,
                  payoutMode: e.target.value === "MIDDLEMAN" ? "AP" : prev.payoutMode,
                }))
              }
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MIDDLEMAN">Middleman</option>
            </select>
          </div>

          {form.payeeType === "EMPLOYEE" ? (
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
          ) : (
            <div className="space-y-2">
              <Label htmlFor="vendor">Middleman</Label>
              <select
                id="vendor"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              >
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.payeeType === "EMPLOYEE" ? (
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
          ) : (
            <div className="space-y-2">
              <Label>Payout Mode</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                AP (Vendor Bill / Vendor Payment)
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="projectRef">Project</Label>
            <Input
              id="projectRef"
              value={form.projectRef}
              onChange={(e) => setForm({ ...form, projectRef: e.target.value })}
              placeholder="Project ID or name"
            />
          </div>
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
              placeholder={form.basisType === "PROFIT" ? "Optional (auto from project)" : "Required for % formula"}
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
            placeholder="Optional if formula is used"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Milestone commission notes"
          />
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Employee commissions can be settled in payroll for salary slip visibility. Middleman commissions are routed through AP.
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row">
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
