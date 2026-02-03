"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ProjectFormDialog } from "@/components/ProjectFormDialog";

export function CreateProjectFromQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [initialData, setInitialData] = useState<{
    projectId?: string;
    name?: string;
    clientId?: string;
    startDate?: string;
    contractValue?: string;
  } | null>(null);

  async function handleCreate() {
    try {
      const res = await fetch(`/api/quotations/${quoteId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }
      const quote = data.data;
      setInitialData({
        projectId: quote.quoteNumber,
        name: quote.projectRef || quote.title || `Project ${quote.quoteNumber}`,
        clientId: quote.clientId || undefined,
        startDate: quote.voucherDate ? new Date(quote.voucherDate).toISOString().split("T")[0] : undefined,
        contractValue: quote.totalAmount ? String(quote.totalAmount) : quote.dueAmount ? String(quote.dueAmount) : "0",
      });
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(handleCreate)}>
        {pending ? "Working..." : "Create Project"}
      </Button>
      <ProjectFormDialog
        open={open}
        onOpenChange={setOpen}
        initialData={initialData ?? undefined}
        onCreated={() => {
          router.refresh();
          router.push("/projects");
        }}
      />
    </>
  );
}
