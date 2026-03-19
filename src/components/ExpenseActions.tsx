"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { ExpenseEditDialog } from "./ExpenseEditDialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, RotateCcw } from "lucide-react";

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
  canReopen,
}: {
  expense: Expense;
  canEditAny: boolean;
  currentUserId?: string | null;
  canMarkPaid?: boolean;
  canReopen?: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const isLegacyInventoryExpense = Boolean(expense.inventoryLedgerId);
  const isPending = expense.status.startsWith("PENDING");
  const isOwner = expense.submittedById && currentUserId && expense.submittedById === currentUserId;
  const canEdit = !isLegacyInventoryExpense && isPending && (canEditAny || isOwner);
  const canDelete = !isLegacyInventoryExpense && isPending && (canEditAny || isOwner);
  const canSetPaid =
    Boolean(canMarkPaid) &&
    (expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED") &&
    expense.paymentSource !== "EMPLOYEE_WALLET";
  const canReopenForEdit =
    Boolean(canReopen) &&
    (expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED") &&
    expense.paymentSource === "EMPLOYEE_POCKET";

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

  async function reopenForEdit() {
    try {
      const res = await fetch(`/api/expenses/${expense.id}/reopen`, { method: "PUT" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to reopen expense");
      }
      toast.success("Expense moved back to pending for correction");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reopen expense");
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {canSetPaid ? (
          <Button size="icon" variant="outline" onClick={markAsPaid} disabled={markingPaid} title="Mark as paid">
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        ) : null}
        {canReopenForEdit ? (
          <Button size="icon" variant="outline" onClick={reopenForEdit} title="Reopen for correction">
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : null}
        {canEdit ? (
          <Button size="icon" variant="outline" onClick={() => setEditOpen(true)} title="Edit expense">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      {canDelete ? <DeleteButton url={`/api/expenses/${expense.id}`} iconOnly /> : null}
      </div>
      {canEdit ? (
        <ExpenseEditDialog open={editOpen} onOpenChange={setEditOpen} expense={expense} />
      ) : null}
    </>
  );
}
