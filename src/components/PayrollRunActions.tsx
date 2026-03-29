"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { PayrollRunFormDialog } from "@/components/PayrollRunFormDialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
      toast.success("Payroll run approved. Now settle each employee entry from Settle Entries.");
    }
    setApproving(false);
  }

  return (
    <>
      <div className="flex gap-2">
        {run.status === "DRAFT" ? (
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        ) : null}
        {canApprove && run.status !== "APPROVED" && run.status !== "POSTED" ? (
          <Button size="sm" onClick={approve} disabled={approving}>
            {approving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              "Approve"
            )}
          </Button>
        ) : null}
        {run.status === "DRAFT" ? <DeleteButton url={`/api/payroll/runs/${run.id}`} /> : null}
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
