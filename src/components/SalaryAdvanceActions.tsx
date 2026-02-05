"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { SalaryAdvanceFormDialog } from "@/components/SalaryAdvanceFormDialog";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };

type SalaryAdvance = {
  id: string;
  employeeId: string;
  amount: number | string;
  reason: string;
  status?: string | null;
};

export function SalaryAdvanceActions({
  advance,
  employees,
  canApprove,
}: {
  advance: SalaryAdvance;
  employees: EmployeeOption[];
  canApprove: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  async function approve() {
    setApproving(true);
    const res = await fetch(`/api/salary-advances/${advance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to approve");
    } else {
      toast.success("Advance approved and paid");
    }
    setApproving(false);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        {canApprove && advance.status !== "PAID" ? (
          <Button size="sm" onClick={approve} disabled={approving}>
            {approving ? "Approving..." : "Approve"}
          </Button>
        ) : null}
        <DeleteButton url={`/api/salary-advances/${advance.id}`} />
      </div>
      {editOpen ? (
        <SalaryAdvanceFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          employees={employees}
          advance={advance}
        />
      ) : null}
    </>
  );
}
