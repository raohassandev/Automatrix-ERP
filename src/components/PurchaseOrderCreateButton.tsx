"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PurchaseOrderFormDialog } from "@/components/PurchaseOrderFormDialog";

export function PurchaseOrderCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create PO</Button>
      <PurchaseOrderFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
