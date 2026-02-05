"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PayrollRunFormDialog } from "@/components/PayrollRunFormDialog";

type EmployeeOption = { id: string; name: string; email: string };

export function PayrollRunCreateButton({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>New Payroll Run</Button>
      {open ? (
        <PayrollRunFormDialog open={open} onOpenChange={setOpen} employees={employees} />
      ) : null}
    </>
  );
}
