"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import VendorAutoComplete from "@/components/VendorAutoComplete";
import { VendorFormDialog } from "@/components/VendorFormDialog";
import ProjectAutoComplete from "@/components/ProjectAutoComplete";

type CompanyAccount = { id: string; name: string; type: string };

type VendorBillRow = {
  id: string;
  billNumber: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
};

type VendorBillListApiRow = {
  id: string;
  billNumber: string;
  projectRef?: string | null;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  vendor: { id: string; name: string };
};

type AllocationDraft = {
  vendorBillId: string;
  amount: number | string;
};

type PaymentData = {
  id: string;
  paymentNumber: string;
  vendorId: string;
  projectRef: string | null;
  paymentDate: string;
  companyAccountId: string;
  method: string | null;
  amount: number;
  status: string;
  notes: string | null;
  allocations: Array<{ vendorBillId: string; amount: number }>;
};

export function VendorPaymentFormDialog({
  open,
  onOpenChange,
  paymentId,
  initialVendorId,
  initialCompanyAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId?: string;
  initialVendorId?: string;
  initialCompanyAccountId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBillRow[]>([]);

  const [form, setForm] = useState({
    paymentNumber: "",
    vendorId: initialVendorId || "",
    projectRef: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    companyAccountId: initialCompanyAccountId || "",
    method: "",
    amount: 0,
    notes: "",
  });
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);

  useEffect(() => {
    if (!paymentId && initialCompanyAccountId) {
      setForm((prev) => ({ ...prev, companyAccountId: initialCompanyAccountId }));
    }
  }, [initialCompanyAccountId, paymentId]);

  const allocationSum = useMemo(
    () => allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0),
    [allocations]
  );

  const autoAllocate = () => {
    const paymentAmount = Number(form.amount) || 0;
    if (paymentAmount <= 0) return;
    setAllocations((prev) => {
      const next = [...prev];
      let remaining = paymentAmount;
      // Allocate in the order shown (usually newest bills first depending on API sorting).
      for (const bill of vendorBills) {
        const idx = next.findIndex((a) => a.vendorBillId === bill.id);
        if (idx === -1) continue;
        const alloc = Math.min(bill.outstandingAmount, remaining);
        next[idx] = { ...next[idx], amount: alloc };
        remaining -= alloc;
        if (remaining <= 0) break;
      }
      return next;
    });
  };

  const allocateMax = (vendorBillId: string) => {
    const paymentAmount = Number(form.amount) || 0;
    const bill = vendorBills.find((b) => b.id === vendorBillId);
    if (!bill || paymentAmount <= 0) return;
    setAllocations((prev) => {
      const othersSum = prev.reduce(
        (sum, a) => sum + (a.vendorBillId === vendorBillId ? 0 : Number(a.amount) || 0),
        0
      );
      const remaining = Math.max(0, paymentAmount - othersSum);
      const nextAmount = Math.min(bill.outstandingAmount, remaining);
      return prev.map((a) => (a.vendorBillId === vendorBillId ? { ...a, amount: nextAmount } : a));
    });
  };

  useEffect(() => {
    if (!open) return;
    fetch("/api/company-accounts")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          setAccounts(data.data);
          if (!form.companyAccountId && data.data.length > 0) {
            setForm((prev) => ({ ...prev, companyAccountId: data.data[0].id }));
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!form.vendorId) {
      setVendorBills([]);
      setAllocations([]);
      return;
    }

    // Fetch bills for allocation UX (server returns paid/outstanding).
    fetch(`/api/procurement/vendor-bills?search=&page=1`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success || !Array.isArray(data.data)) return;
        const list = (data.data as VendorBillListApiRow[])
          .filter((row) => row?.vendor?.id === form.vendorId)
          .filter((row) => {
            const selectedProject = String(form.projectRef || "").trim();
            if (!selectedProject) return true;
            return String(row.projectRef || "").trim() === selectedProject;
          })
          .map((row) => ({
            id: row.id,
            billNumber: row.billNumber,
            totalAmount: Number(row.totalAmount || 0),
            paidAmount: Number(row.paidAmount || 0),
            outstandingAmount: Number(row.outstandingAmount || 0),
            status: String(row.status || ""),
          }))
          // Only allocate against posted bills for now (enforced server-side too).
          .filter((row: VendorBillRow) => row.status === "POSTED" && row.outstandingAmount > 0);

        setVendorBills(list);
        setAllocations((prev) => {
          // Keep any existing rows, but drop allocations for bills that no longer exist.
          const existingMap = new Map(prev.map((a) => [a.vendorBillId, a.amount]));
          return list.map((bill: VendorBillRow) => ({
            vendorBillId: bill.id,
            amount: existingMap.get(bill.id) ?? 0,
          }));
        });
      })
      .catch(() => {});
  }, [open, form.vendorId, form.projectRef]);

  useEffect(() => {
    if (!open) return;
    if (!paymentId) return;
    setLoading(true);
    fetch(`/api/procurement/vendor-payments/${paymentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success || !data.data) {
          toast.error(data?.error || "Failed to load payment");
          return;
        }
        const payment = data.data as PaymentData;
        setForm({
          paymentNumber: payment.paymentNumber,
          vendorId: payment.vendorId,
          projectRef: payment.projectRef || "",
          paymentDate: payment.paymentDate.slice(0, 10),
          companyAccountId: payment.companyAccountId,
          method: payment.method || "",
          amount: Number(payment.amount),
          notes: payment.notes || "",
        });
        setAllocations(
          payment.allocations?.map((a) => ({ vendorBillId: a.vendorBillId, amount: Number(a.amount) })) || []
        );
      })
      .catch(() => toast.error("Failed to load payment"))
      .finally(() => setLoading(false));
  }, [open, paymentId]);

  const updateAllocation = (vendorBillId: string, amount: string) => {
    setAllocations((prev) =>
      prev.map((a) => (a.vendorBillId === vendorBillId ? { ...a, amount } : a))
    );
  };

  async function submit() {
    if (!form.paymentNumber || !form.vendorId || !form.paymentDate || !form.companyAccountId) {
      toast.error("Payment number, vendor, date, and account are required.");
      return;
    }
    if (Number(form.amount) <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }

    const cleanedAllocations = allocations
      .map((a) => ({ vendorBillId: a.vendorBillId, amount: Number(a.amount) }))
      .filter((a) => a.vendorBillId && a.amount > 0);

    const payload = {
      paymentNumber: form.paymentNumber.trim(),
      vendorId: form.vendorId,
      projectRef: form.projectRef || undefined,
      paymentDate: form.paymentDate,
      companyAccountId: form.companyAccountId,
      method: form.method?.trim() || undefined,
      amount: Number(form.amount),
      notes: form.notes?.trim() || undefined,
      allocations: cleanedAllocations.length > 0 ? cleanedAllocations : undefined,
    };

    const url = paymentId ? `/api/procurement/vendor-payments/${paymentId}` : "/api/procurement/vendor-payments";
    const method = paymentId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to save vendor payment");
      return;
    }

    toast.success(paymentId ? "Vendor payment updated" : "Vendor payment created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={paymentId ? "Edit Vendor Payment" : "Create Vendor Payment"}
      description="Simple flow: choose vendor + project + account, enter amount, then allocate to open bills."
    >
      {loading ? <div className="p-2 text-sm text-muted-foreground">Loading...</div> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Allocate only what you are paying today. You can leave allocations empty to save draft first.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paymentNumber">Payment Number</Label>
            <Input
              id="paymentNumber"
              value={form.paymentNumber}
              onChange={(e) => setForm({ ...form, paymentNumber: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Vendor</Label>
            <VendorAutoComplete
              value={form.vendorId}
              onChange={(value) => setForm({ ...form, vendorId: value })}
              onSelectVendor={(vendor) => {
                if (vendor) setForm((prev) => ({ ...prev, vendorId: vendor.id }));
              }}
              refreshKey={vendorRefreshKey}
              placeholder="Select vendor"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setVendorDialogOpen(true)}>
              Create Vendor
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <ProjectAutoComplete
              value={form.projectRef}
              onChange={(value) => setForm((prev) => ({ ...prev, projectRef: value }))}
              placeholder="Select project (optional)..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <DateField
              id="paymentDate"
              value={form.paymentDate}
              onChange={(value) => setForm({ ...form, paymentDate: value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyAccountId">Company Account</Label>
            <select
              id="companyAccountId"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.companyAccountId}
              onChange={(e) => setForm({ ...form, companyAccountId: e.target.value })}
              required
            >
              <option value="" disabled>
                Select account...
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method (optional)</Label>
            <Input id="method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (PKR)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={String(form.amount)}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Allocations (optional)</div>
              <div className="text-xs text-muted-foreground">
                Only posted bills with outstanding amount appear here.
              </div>
            </div>
            {vendorBills.length > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={autoAllocate}>
                Auto allocate
              </Button>
            ) : null}
          </div>

          {form.vendorId ? (
            vendorBills.length === 0 ? (
              <div className="text-sm text-muted-foreground">No outstanding posted bills for this vendor.</div>
            ) : (
              <div className="space-y-2">
                {vendorBills.map((bill) => {
                  const draft = allocations.find((a) => a.vendorBillId === bill.id);
                  return (
                    <div key={bill.id} className="grid gap-2 md:grid-cols-12 items-end">
                      <div className="md:col-span-6 text-sm">
                        <div className="font-medium">{bill.billNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          Outstanding: PKR {bill.outstandingAmount.toLocaleString()}
                        </div>
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-xs">Allocate</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={String(draft?.amount ?? 0)}
                          onChange={(e) => updateAllocation(bill.id, e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          Total: PKR {bill.totalAmount.toLocaleString()} | Paid: PKR {bill.paidAmount.toLocaleString()}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => allocateMax(bill.id)}>
                          Max
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">Select a vendor to load outstanding bills.</div>
          )}

          <div className="text-right text-sm">
            <span className="text-muted-foreground">Allocated: </span>
            <span className="font-semibold">PKR {allocationSum.toLocaleString()}</span>
          </div>
          <div className="text-right text-sm">
            <span className="text-muted-foreground">Unallocated: </span>
            <span className="font-semibold">
              PKR {Math.max(0, Number(form.amount) - allocationSum).toLocaleString()}
            </span>
          </div>
          {allocationSum > Number(form.amount) ? (
            <div className="text-sm text-red-600">Allocation total cannot exceed payment amount.</div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || allocationSum > Number(form.amount)}>
            {pending ? "Saving..." : paymentId ? "Save Changes" : "Create Payment"}
          </Button>
        </div>
      </form>

      <VendorFormDialog
        open={vendorDialogOpen}
        onOpenChange={(next) => {
          setVendorDialogOpen(next);
          if (!next) setVendorRefreshKey((k) => k + 1);
        }}
        onSaved={() => {
          setVendorDialogOpen(false);
          setVendorRefreshKey((k) => k + 1);
        }}
      />
    </FormDialog>
  );
}
