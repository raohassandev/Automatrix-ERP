"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { ExpenseEditDialog } from "./ExpenseEditDialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Expense = {
  id: string;
  date: string | Date;
  description: string;
  category: string;
  amount: number;
  paymentMode: string;
  paymentSource?: string | null;
  companyAccountId?: string | null;
  expenseType?: string | null;
  project?: string | null;
  remarks?: string | null;
  categoryRequest?: string | null;
  receiptUrl?: string | null;
  receiptFileId?: string | null;
  status: string;
  submittedById?: string | null;
  inventoryLedgerId?: string | null;
};

export function ExpenseActions({
  expense,
  canEditAny,
  currentUserId,
  canMarkPaid,
}: {
  expense: Expense;
  canEditAny: boolean;
  currentUserId?: string | null;
  canMarkPaid?: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const isLegacyInventoryExpense = Boolean(expense.inventoryLedgerId);
  const isPending = expense.status.startsWith("PENDING");
  const isOwner = expense.submittedById && currentUserId && expense.submittedById === currentUserId;
  const canEdit = !isLegacyInventoryExpense && isPending && (canEditAny || isOwner);
  const canDelete = !isLegacyInventoryExpense && isPending && (canEditAny || isOwner);
  const canSetPaid = Boolean(canMarkPaid) && expense.status === "APPROVED";

  async function markAsPaid() {
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}/mark-as-paid`, {
        method: "PUT",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to mark expense as paid");
      }
      toast.success("Expense marked as paid");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark expense as paid");
    } finally {
      setMarkingPaid(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {canSetPaid ? (
          <Button size="sm" variant="outline" onClick={markAsPaid} disabled={markingPaid}>
            {markingPaid ? "Posting..." : "Mark Paid"}
          </Button>
        ) : null}
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        ) : null}
        {canDelete ? <DeleteButton url={`/api/expenses/${expense.id}`} /> : null}
      </div>
      {canEdit ? (
        <ExpenseEditDialog open={editOpen} onOpenChange={setEditOpen} expense={expense} />
      ) : null}
    </>
  );
}
