"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import VendorAutoComplete from "@/components/VendorAutoComplete";
import { VendorFormDialog } from "@/components/VendorFormDialog";

type BillLine = {
  description: string;
  total: number | string;
  project?: string;
};

type BillData = {
  id: string;
  billNumber: string;
  vendorId: string;
  billDate: string;
  dueDate: string | null;
  currency: string;
  notes: string | null;
  status: string;
  lines: Array<{ description: string; total: number; project: string | null }>;
};

const createLine = (): BillLine => ({ description: "", total: 0, project: "" });

export function VendorBillFormDialog({
  open,
  onOpenChange,
  billId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);

  const [form, setForm] = useState({
    billNumber: "",
    vendorId: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    currency: "PKR",
    notes: "",
  });
  const [lines, setLines] = useState<BillLine[]>([createLine()]);

  useEffect(() => {
    if (!open) return;
    if (!billId) return;
    fetch(`/api/procurement/vendor-bills/${billId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success || !data.data) {
          toast.error(data?.error || "Failed to load bill");
          return;
        }
        const bill = data.data as BillData;
        setForm({
          billNumber: bill.billNumber,
          vendorId: bill.vendorId,
          billDate: bill.billDate.slice(0, 10),
          dueDate: bill.dueDate ? bill.dueDate.slice(0, 10) : "",
          currency: bill.currency || "PKR",
          notes: bill.notes || "",
        });
        setLines(
          bill.lines?.length
            ? bill.lines.map((l) => ({
                description: l.description,
                total: l.total,
                project: l.project || "",
              }))
            : [createLine()]
        );
      })
      .catch(() => toast.error("Failed to load bill"))
  }, [open, billId]);

  const total = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0);
  }, [lines]);

  const updateLine = (index: number, key: keyof BillLine, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, createLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  async function submit() {
    if (!form.billNumber || !form.vendorId || !form.billDate) {
      toast.error("Bill number, vendor, and bill date are required");
      return;
    }
    const cleanedLines = lines
      .map((l) => ({
        description: l.description.trim(),
        total: Number(l.total),
        project: (l.project || "").trim() || undefined,
      }))
      .filter((l) => l.description && Number.isFinite(l.total));

    if (cleanedLines.length === 0) {
      toast.error("Add at least one bill line");
      return;
    }

    const payload = {
      billNumber: form.billNumber,
      vendorId: form.vendorId,
      billDate: form.billDate,
      dueDate: form.dueDate || undefined,
      currency: form.currency || "PKR",
      notes: form.notes || undefined,
      lines: cleanedLines,
    };

    const url = billId ? `/api/procurement/vendor-bills/${billId}` : "/api/procurement/vendor-bills";
    const method = billId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to save vendor bill");
      return;
    }

    toast.success(billId ? "Vendor bill updated" : "Vendor bill created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={billId ? "Edit Vendor Bill" : "Create Vendor Bill"}
      description="Record vendor bills (multi-line). Posting/allocations handled separately."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billNumber">Bill Number</Label>
            <Input
              id="billNumber"
              value={form.billNumber}
              onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Vendor</Label>
            <VendorAutoComplete
              value={form.vendorId}
              onChange={(value) => setForm({ ...form, vendorId: value })}
              onSelectVendor={(vendor) => {
                if (vendor) {
                  setForm((prev) => ({ ...prev, vendorId: vendor.id }));
                }
              }}
              refreshKey={vendorRefreshKey}
              placeholder="Select vendor"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVendorDialogOpen(true)}
            >
              Create Vendor
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billDate">Bill Date</Label>
            <Input
              id="billDate"
              type="date"
              value={form.billDate}
              onChange={(e) => setForm({ ...form, billDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Bill Lines</div>
              <div className="text-xs text-muted-foreground">Describe items/services and totals (PKR).</div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              Add Line
            </Button>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-12 items-end">
                <div className="md:col-span-7 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    placeholder="e.g., PLC + HMI supply"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs">Total</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={String(line.total)}
                    onChange={(e) => updateLine(idx, "total", e.target.value)}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs">Project (opt)</Label>
                  <Input
                    value={line.project || ""}
                    onChange={(e) => updateLine(idx, "project", e.target.value)}
                    placeholder="AE-..."
                  />
                </div>
                <div className="md:col-span-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-right text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">PKR {total.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : billId ? "Save Changes" : "Create Bill"}
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
