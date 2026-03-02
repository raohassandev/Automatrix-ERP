"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommissionFormDialog } from "@/components/CommissionFormDialog";

type EmployeeOption = { id: string; name: string; email: string };
type VendorOption = { id: string; name: string };

export function CommissionCreateButton({
  employees,
  vendors,
}: {
  employees: EmployeeOption[];
  vendors: VendorOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Commission</Button>
      {open ? (
        <CommissionFormDialog
          open={open}
          onOpenChange={setOpen}
          employees={employees}
          vendors={vendors}
        />
      ) : null}
    </>
  );
}
