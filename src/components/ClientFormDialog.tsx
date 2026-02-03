"use client";

import { FormDialog } from "./FormDialog";
import { ClientForm } from "./ClientForm";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function ClientFormDialog({ open, onOpenChange, onCreated }: ClientFormDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Client"
      description="Add a new client and contact persons"
    >
      <ClientForm
        showHeader={false}
        onCreated={() => {
          onCreated?.();
          onOpenChange(false);
        }}
      />
    </FormDialog>
  );
}
