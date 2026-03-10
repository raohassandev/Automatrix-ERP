"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PayrollAutoDraftButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function triggerAutoDraft() {
    const res = await fetch("/api/payroll/runs/auto-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.error || "Failed to run payroll auto-draft.");
      return;
    }
    if (payload?.skipped) {
      toast.message(payload?.reason || "Auto-draft skipped.");
    } else {
      toast.success("Monthly payroll draft generated. Review and approve when ready.");
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => startTransition(triggerAutoDraft)}
      disabled={pending}
      title="Force-run auto draft generation for the current previous month period"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        "Auto-Create Draft"
      )}
    </Button>
  );
}

