"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { VendorFormDialog } from "./VendorFormDialog";

type Vendor = {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string | null;
};

export function VendorActions({ vendor, canEdit }: { vendor: Vendor; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/vendors/${vendor.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <VendorFormDialog open={editOpen} onOpenChange={setEditOpen} initialData={vendor} />
      ) : null}
    </>
  );
}
