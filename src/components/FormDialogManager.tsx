"use client";

import { ExpenseFormDialog } from "./ExpenseFormDialog";
import { IncomeFormDialog } from "./IncomeFormDialog";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { ProjectFormDialog } from "./ProjectFormDialog";
import { ClientFormDialog } from "./ClientFormDialog";
import { InventoryFormDialog } from "./InventoryFormDialog";
import { InvoiceFormDialog } from "./InvoiceFormDialog";

export type FormType =
  | "expense"
  | "income"
  | "employee"
  | "project"
  | "client"
  | "inventory"
  | "invoice"
  | null;

interface FormDialogManagerProps {
  openForm: FormType;
  onClose: () => void;
}

export function FormDialogManager({ openForm, onClose }: FormDialogManagerProps) {
  return (
    <>
      <ExpenseFormDialog 
        open={openForm === "expense"} 
        onOpenChange={(open) => !open && onClose()} 
      />
      <IncomeFormDialog 
        open={openForm === "income"} 
        onOpenChange={(open) => !open && onClose()} 
      />
      <EmployeeFormDialog 
        open={openForm === "employee"} 
        onOpenChange={(open) => !open && onClose()} 
      />
      <ProjectFormDialog 
        open={openForm === "project"} 
        onOpenChange={(open) => !open && onClose()} 
      />
      <ClientFormDialog
        open={openForm === "client"}
        onOpenChange={(open) => !open && onClose()}
      />
      <InventoryFormDialog 
        open={openForm === "inventory"} 
        onOpenChange={(open) => !open && onClose()} 
      />
      <InvoiceFormDialog 
        open={openForm === "invoice"} 
        onOpenChange={(open) => !open && onClose()} 
      />
    </>
  );
}
