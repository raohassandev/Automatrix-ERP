"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoodsReceiptFormDialog } from "@/components/GoodsReceiptFormDialog";

export function GoodsReceiptCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create GRN</Button>
      <GoodsReceiptFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
