"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/format";
import { employeeCodeFromId } from "@/lib/employee-display";

type PayrollEntryRow = {
  id: string;
  employeeId: string;
  employeeName?: string | null;
  baseSalary: number;
  incentiveTotal: number;
  deductions: number;
  netPay: number;
  status: string;
};

type PayrollEntrySettlementDialogProps = {
  payrollRunId: string;
  runStatus: string;
  entries: PayrollEntryRow[];
  canApprove: boolean;
  companyAccounts: Array<{ id: string; name: string; type: string }>;
};

export function PayrollEntrySettlementDialog({
  payrollRunId,
  runStatus,
  entries,
  canApprove,
  companyAccounts,
}: PayrollEntrySettlementDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [companyAccountId, setCompanyAccountId] = useState(companyAccounts[0]?.id || "");
  const [paymentReference, setPaymentReference] = useState("");
  const [pending, startTransition] = useTransition();

  const canSettle = canApprove && (runStatus === "APPROVED" || runStatus === "POSTED");
  const unpaidCount = useMemo(
    () => entries.filter((entry) => String(entry.status || "").toUpperCase() !== "PAID").length,
    [entries],
  );
  const paidCount = entries.length - unpaidCount;

  async function markEntryPaid(entryId: string) {
    if (!canSettle) {
      toast.error("Approve payroll run before settling individual employee payment.");
      return;
    }
    if (!companyAccountId) {
      toast.error("Select company account for payroll disbursement.");
      return;
    }
    setPendingEntryId(entryId);
    try {
      const res = await fetch(`/api/payroll/runs/${payrollRunId}/entries/${entryId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMode,
          companyAccountId,
          paymentReference: paymentReference.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Failed to mark payroll entry as paid.");
        return;
      }
      toast.success("Payroll entry marked paid.");
      router.refresh();
    } catch (error) {
      console.error("Failed to mark payroll entry as paid:", error);
      toast.error("Failed to mark payroll entry as paid.");
    } finally {
      setPendingEntryId(null);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title={
          canSettle
            ? "Settle payroll entries employee-by-employee"
            : "Approve payroll run first to settle entries"
        }
      >
        Settle Entries
      </Button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Payroll Entry Settlement"
        description="Mark each employee payroll line as paid after payout confirmation."
        className="max-w-5xl"
      >
        <div className="space-y-4">
        <div className="grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 md:grid-cols-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Run status:</span>{" "}
              <span className="font-semibold">{runStatus}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Paid:</span>{" "}
              <span className="font-semibold">{paidCount}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Pending:</span>{" "}
              <span className="font-semibold">{unpaidCount}</span>
            </div>
          </div>

          {!canSettle ? (
            <div className="rounded-md border border-amber-300/35 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              Approve this payroll run first, then settle each employee entry as payment is executed.
            </div>
          ) : null}

          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Net Pay</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isPaid = String(entry.status || "").toUpperCase() === "PAID";
                  const isBusy = pendingEntryId === entry.id;
                  return (
                    <tr key={entry.id} className="border-b align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {employeeCodeFromId(entry.employeeId)} - {entry.employeeName || "Employee"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Base {formatMoney(entry.baseSalary)} | Incentive {formatMoney(entry.incentiveTotal)} | Deductions {formatMoney(entry.deductions)}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatMoney(entry.netPay)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => startTransition(() => markEntryPaid(entry.id))}
                          disabled={!canSettle || isPaid || isBusy || pending}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Posting...
                            </>
                          ) : isPaid ? (
                            "Paid"
                          ) : (
                            "Mark Paid"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              Payment mode
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE">Online</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Company account
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
                value={companyAccountId}
                onChange={(event) => setCompanyAccountId(event.target.value)}
              >
                {companyAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Payment reference
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder="Txn/cheque/reference no."
              />
            </label>
          </div>
        </div>
      </FormDialog>
    </>
  );
}
