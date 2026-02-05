"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { DesignationFormDialog } from "@/components/DesignationFormDialog";

type Designation = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
};

export function DesignationActions({ designation, canEdit }: { designation: Designation; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/designations/${designation.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <DesignationFormDialog open={editOpen} onOpenChange={setEditOpen} initialData={designation} />
      ) : null}
    </>
  );
}
