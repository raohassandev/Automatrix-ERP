"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/TableActions";
import { DepartmentFormDialog } from "@/components/DepartmentFormDialog";

type Department = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
};

export function DepartmentActions({ department, canEdit }: { department: Department; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/departments/${department.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <DepartmentFormDialog open={editOpen} onOpenChange={setEditOpen} initialData={department} />
      ) : null}
    </>
  );
}
