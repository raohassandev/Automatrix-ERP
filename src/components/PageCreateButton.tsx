"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormDialogManager, type FormType } from "@/components/FormDialogManager";

interface PageCreateButtonProps {
  label: string;
  formType: FormType;
}

export function PageCreateButton({ label, formType }: PageCreateButtonProps) {
  const [openFormDialog, setOpenFormDialog] = useState<FormType>(null);

  return (
    <>
      <Button onClick={() => setOpenFormDialog(formType)}>
        {label}
      </Button>
      <FormDialogManager
        openForm={openFormDialog}
        onClose={() => setOpenFormDialog(null)}
      />
    </>
  );
}
