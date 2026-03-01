"use client";

import { useState } from "react";
import { DeleteButton } from "./TableActions";
import { Button } from "./ui/button";
import { IncomeEditDialog } from "./IncomeEditDialog";

type IncomeEntry = {
  id: string;
  date: string | Date;
  source: string;
  amount: number;
  paymentMode: string;
  companyAccountId?: string | null;
  project?: string | null;
  invoiceId?: string | null;
  remarks?: string | null;
  status: string;
  addedById?: string | null;
};

export function IncomeActions({
  entry,
  canEditAny,
  currentUserId,
}: {
  entry: IncomeEntry;
  canEditAny: boolean;
  currentUserId: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const canEdit =
    canEditAny || (entry.addedById === currentUserId && entry.status === "PENDING");

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        ) : null}
        {canEdit ? <DeleteButton url={`/api/income/${entry.id}`} /> : null}
      </div>
      {canEdit ? (
        <IncomeEditDialog open={editOpen} onOpenChange={setEditOpen} entry={entry} />
      ) : null}
    </>
  );
}
