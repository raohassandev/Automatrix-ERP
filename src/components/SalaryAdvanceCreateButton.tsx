"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SalaryAdvanceFormDialog } from "@/components/SalaryAdvanceFormDialog";

type EmployeeOption = { id: string; name: string; email: string };

export function SalaryAdvanceCreateButton({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Request Advance</Button>
      {open ? (
        <SalaryAdvanceFormDialog open={open} onOpenChange={setOpen} employees={employees} />
      ) : null}
    </>
  );
}
