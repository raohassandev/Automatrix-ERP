"use client";

import { FormDialog } from "./FormDialog";
import { ClientForm } from "./ClientForm";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialData?: {
    id: string;
    name: string;
    description?: string | null;
    address?: string | null;
    contacts?: { name: string; phone?: string; designation?: string; email?: string }[];
  };
}

export function ClientFormDialog({ open, onOpenChange, onCreated, initialData }: ClientFormDialogProps) {
  const isEdit = Boolean(initialData?.id);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Client" : "Create Client"}
      description={isEdit ? "Update client and contact persons" : "Add a new client and contact persons"}
    >
      <ClientForm
        showHeader={false}
        initialData={initialData}
        onCreated={() => {
          onCreated?.();
          onOpenChange(false);
        }}
        onSaved={() => {
          onOpenChange(false);
        }}
      />
    </FormDialog>
  );
}
