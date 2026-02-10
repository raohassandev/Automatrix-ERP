"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VendorPaymentFormDialog } from "@/components/VendorPaymentFormDialog";

export function VendorPaymentCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Vendor Payment</Button>
      <VendorPaymentFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

