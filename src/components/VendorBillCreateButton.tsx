"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VendorBillFormDialog } from "@/components/VendorBillFormDialog";

export function VendorBillCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Vendor Bill</Button>
      <VendorBillFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

