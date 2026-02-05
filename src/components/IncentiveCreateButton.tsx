"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IncentiveFormDialog } from "@/components/IncentiveFormDialog";

type EmployeeOption = { id: string; name: string; email: string };

export function IncentiveCreateButton({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Incentive</Button>
      {open ? (
        <IncentiveFormDialog open={open} onOpenChange={setOpen} employees={employees} />
      ) : null}
    </>
  );
}
