"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { InvoiceFormDialog } from "./InvoiceFormDialog";

type Invoice = {
  id: string;
  invoiceNo: string;
  projectId: string;
  date: string | Date;
  dueDate: string | Date;
  amount: number | string;
  status: string;
  notes?: string | null;
  paymentDate?: string | Date | null;
};

export function InvoiceActions({ invoice, canEdit }: { invoice: Invoice; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/invoices/${invoice.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <InvoiceFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initialData={{
            id: invoice.id,
            invoiceNo: invoice.invoiceNo,
            projectId: invoice.projectId,
            date: invoice.date,
            dueDate: invoice.dueDate,
            amount: Number(invoice.amount),
            status: invoice.status,
            notes: invoice.notes,
            paymentDate: invoice.paymentDate ?? null,
          }}
        />
      ) : null}
    </>
  );
}
