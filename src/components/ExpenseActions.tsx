"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { ExpenseEditDialog } from "./ExpenseEditDialog";

type Expense = {
  id: string;
  date: string | Date;
  description: string;
  category: string;
  amount: number;
  paymentMode: string;
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
}: {
  expense: Expense;
  canEditAny: boolean;
  currentUserId?: string | null;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isLegacyInventoryExpense = Boolean(expense.inventoryLedgerId);
  const isPending = expense.status.startsWith("PENDING");
  const isOwner = expense.submittedById && currentUserId && expense.submittedById === currentUserId;
  const canEdit = !isLegacyInventoryExpense && isPending && (canEditAny || isOwner);
  const canDelete = !isLegacyInventoryExpense && isPending && (canEditAny || isOwner);

  return (
    <>
      <div className="flex gap-2">
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
