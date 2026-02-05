"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { CommissionFormDialog } from "@/components/CommissionFormDialog";
import { toast } from "sonner";

type EmployeeOption = { id: string; name: string; email: string };

type Commission = {
  id: string;
  employeeId: string;
  projectRef?: string | null;
  basisType?: string | null;
  basisAmount?: number | string | null;
  percent?: number | string | null;
  amount?: number | string;
  reason?: string | null;
  status?: string | null;
};

export function CommissionActions({
  commission,
  employees,
  canApprove,
}: {
  commission: Commission;
  employees: EmployeeOption[];
  canApprove: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  async function approve() {
    setApproving(true);
    const res = await fetch(`/api/commissions/${commission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to approve");
    } else {
      toast.success("Commission approved");
    }
    setApproving(false);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        {canApprove && commission.status !== "APPROVED" ? (
          <Button size="sm" onClick={approve} disabled={approving}>
            {approving ? "Approving..." : "Approve"}
          </Button>
        ) : null}
        <DeleteButton url={`/api/commissions/${commission.id}`} />
      </div>
      {editOpen ? (
        <CommissionFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          employees={employees}
          commission={commission}
        />
      ) : null}
    </>
  );
}
