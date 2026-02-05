"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { IncentiveFormDialog } from "@/components/IncentiveFormDialog";
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

export function IncentiveActions({
  incentive,
  employees,
  canApprove,
}: {
  incentive: Incentive;
  employees: EmployeeOption[];
  canApprove: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  async function approve() {
    setApproving(true);
    const res = await fetch(`/api/incentives/${incentive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to approve");
    } else {
      toast.success("Incentive approved");
    }
    setApproving(false);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        {canApprove && incentive.status !== "APPROVED" ? (
          <Button size="sm" onClick={approve} disabled={approving}>
            {approving ? "Approving..." : "Approve"}
          </Button>
        ) : null}
        <DeleteButton url={`/api/incentives/${incentive.id}`} />
      </div>
      {editOpen ? (
        <IncentiveFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          employees={employees}
          incentive={incentive}
        />
      ) : null}
    </>
  );
}
