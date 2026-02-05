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
  const canEdit =
    canEditAny ||
    (expense.submittedById && currentUserId && expense.submittedById === currentUserId && expense.status.startsWith("PENDING"));

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        ) : null}
        {canEdit ? <DeleteButton url={`/api/expenses/${expense.id}`} /> : null}
      </div>
      {canEdit ? (
        <ExpenseEditDialog open={editOpen} onOpenChange={setEditOpen} expense={expense} />
      ) : null}
    </>
  );
}
