"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

type ProcurementApprovalType = "VENDOR_BILL" | "VENDOR_PAYMENT";

export interface ProcurementApprovalItem {
  id: string;
  type: ProcurementApprovalType;
  number: string;
  date: Date;
  amount: number;
  requiredApprovalLevel: "L1" | "L2" | "L3";
  vendorName: string;
  projectRef?: string | null;
  companyAccountName?: string | null;
}

function levelClass(level: "L1" | "L2" | "L3") {
  if (level === "L1") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (level === "L2") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-red-500/15 text-red-700 dark:text-red-300";
}

function documentHref(item: ProcurementApprovalItem) {
  if (item.type === "VENDOR_BILL") {
    return `/procurement/vendor-bills?search=${encodeURIComponent(item.number)}`;
  }
  return `/procurement/vendor-payments?search=${encodeURIComponent(item.number)}`;
}

export default function ProcurementApprovalQueue({
  approvals,
}: {
  approvals: ProcurementApprovalItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    return {
      count: approvals.length,
      amount: approvals.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }, [approvals]);

  async function doAction(item: ProcurementApprovalItem, action: "APPROVE" | "VOID") {
    const reason = (reasonById[item.id] || "").trim();
    if (action === "VOID" && reason.length === 0) {
      toast.error("Reason is required for rejection.");
      return;
    }

    const endpoint =
      item.type === "VENDOR_BILL"
        ? `/api/procurement/vendor-bills/${item.id}`
        : `/api/procurement/vendor-payments/${item.id}`;

    startTransition(async () => {
      setSelectedId(item.id);
      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reason: reason || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Approval action failed");
        }
        toast.success(
          action === "APPROVE" ? "Procurement document approved." : "Procurement document rejected."
        );
        setReasonById((prev) => ({ ...prev, [item.id]: "" }));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Approval action failed");
      } finally {
        setSelectedId(null);
      }
    });
  }

  if (approvals.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card/95 shadow-sm">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">Procurement Approvals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.count} pending document(s), {formatMoney(totals.amount)} total exposure.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Project / Account
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Level
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {approvals.map((item) => (
              <tr key={item.id} className="hover:bg-accent">
                <td className="px-4 py-3 text-sm text-foreground">
                  {item.type === "VENDOR_BILL" ? "Vendor Bill" : "Vendor Payment"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Link href={documentHref(item)} className="font-medium text-primary hover:underline">
                    {item.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {new Date(item.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{item.vendorName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  <div>{item.projectRef || "No project"}</div>
                  {item.companyAccountName ? <div>{item.companyAccountName}</div> : null}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground">
                  {formatMoney(item.amount)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${levelClass(item.requiredApprovalLevel)}`}>
                    {item.requiredApprovalLevel}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex min-w-[330px] items-center gap-2">
                    <input
                      className="w-40 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                      placeholder="Reject reason"
                      value={reasonById[item.id] || ""}
                      onChange={(e) =>
                        setReasonById((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      disabled={pending && selectedId === item.id}
                    />
                    <Button
                      size="sm"
                      disabled={pending && selectedId === item.id}
                      onClick={() => doAction(item, "APPROVE")}
                    >
                      {pending && selectedId === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending && selectedId === item.id}
                      onClick={() => doAction(item, "VOID")}
                    >
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
