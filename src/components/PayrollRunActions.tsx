"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { PayrollRunFormDialog } from "@/components/PayrollRunFormDialog";
import { toast } from "sonner";

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

export function PayrollRunActions({
  run,
  employees,
  canApprove,
}: {
  run: PayrollRun;
  employees: EmployeeOption[];
  canApprove: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  async function approve() {
    setApproving(true);
    const res = await fetch(`/api/payroll/runs/${run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to approve payroll");
    } else {
      toast.success("Payroll approved and credited to wallets");
    }
    setApproving(false);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        {canApprove && run.status !== "APPROVED" ? (
          <Button size="sm" onClick={approve} disabled={approving}>
            {approving ? "Approving..." : "Approve"}
          </Button>
        ) : null}
        <DeleteButton url={`/api/payroll/runs/${run.id}`} />
      </div>
      {editOpen ? (
        <PayrollRunFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          employees={employees}
          run={run}
        />
      ) : null}
    </>
  );
}
