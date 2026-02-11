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
import ProjectAutoComplete from "@/components/ProjectAutoComplete";

type BillLine = {
  description: string;
  itemId?: string;
  grnItemId?: string;
  quantity?: number | string;
  unit?: string;
  unitCost?: number | string;
  total?: number | string;
};

type BillData = {
  id: string;
  billNumber: string;
  vendorId: string;
  projectRef: string | null;
  billDate: string;
  dueDate: string | null;
  currency: string;
  notes: string | null;
  status: string;
  lines: Array<{
    description: string;
    itemId: string | null;
    grnItemId: string | null;
    quantity: number | null;
    unit: string | null;
    unitCost: number | null;
    total: number;
    project: string | null;
  }>;
};

type InventoryItemOption = { id: string; name: string; unit: string };

type GrnListRow = {
  id: string;
  grnNumber: string;
  status: string;
  receivedDate: string;
  projectRef?: string | null;
  purchaseOrder: { id: string; poNumber: string; vendorId: string | null; vendorName: string } | null;
  items: Array<{
    id: string;
    itemName: string;
    unit: string | null;
    quantity: string | number;
    unitCost: string | number;
  }>;
};

const createLine = (): BillLine => ({
  description: "",
  quantity: "",
  unit: "",
  unitCost: "",
  total: "",
});

const normalizeKey = (value?: string | null) => (value || "").trim().toLowerCase();

export function VendorBillFormDialog({
  open,
  onOpenChange,
  billId,
  initialProjectRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId?: string;
  initialProjectRef?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
  const [grns, setGrns] = useState<GrnListRow[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState("");

  const [form, setForm] = useState({
    billNumber: "",
    vendorId: "",
    projectRef: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    currency: "PKR",
    notes: "",
  });
  const [lines, setLines] = useState<BillLine[]>([createLine()]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !billId) {
      setSelectedGrnId("");
      setForm({
        billNumber: "",
        vendorId: "",
        projectRef: initialProjectRef || "",
        billDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        currency: "PKR",
        notes: "",
      });
      setLines([createLine()]);
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) return;

    fetch("/api/inventory")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          setInventoryItems(
            (data.data as Array<{ id: string; name: string; unit: string }>).map((i) => ({
              id: i.id,
              name: i.name,
              unit: i.unit,
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/procurement/grn")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          setGrns(data.data as GrnListRow[]);
        }
      })
      .catch(() => {});
  }, [open]);

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
          projectRef: bill.projectRef || "",
          billDate: bill.billDate.slice(0, 10),
          dueDate: bill.dueDate ? bill.dueDate.slice(0, 10) : "",
          currency: bill.currency || "PKR",
          notes: bill.notes || "",
        });
        setLines(
          bill.lines?.length
            ? bill.lines.map((l) => ({
                description: l.description,
                itemId: l.itemId || undefined,
                grnItemId: l.grnItemId || undefined,
                quantity: l.quantity ?? "",
                unit: l.unit || "",
                unitCost: l.unitCost ?? "",
                total: l.total,
              }))
            : [createLine()]
        );
      })
      .catch(() => toast.error("Failed to load bill"))
  }, [open, billId]);

  const computedLineTotals = useMemo(() => {
    return lines.map((l) => {
      const qty = Number(l.quantity);
      const cost = Number(l.unitCost);
      if (Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost >= 0) {
        return qty * cost;
      }
      return Number(l.total) || 0;
    });
  }, [lines]);

  const total = useMemo(() => computedLineTotals.reduce((sum, t) => sum + t, 0), [computedLineTotals]);

  const updateLine = (index: number, key: keyof BillLine, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  };

  const updateLineItem = (index: number, itemId: string) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const selected = inventoryItems.find((it) => it.id === itemId);
        return {
          ...l,
          itemId: itemId || undefined,
          unit: selected?.unit || l.unit || "",
          description: l.description || selected?.name || "",
        };
      })
    );
  };

  const addLine = () => setLines((prev) => [...prev, createLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const importFromGrn = async () => {
    if (!selectedGrnId) return;
    const grn = grns.find((g) => g.id === selectedGrnId);
    if (!grn) return;

    if (grn.purchaseOrder?.vendorId && !form.vendorId) {
      setForm((prev) => ({ ...prev, vendorId: grn.purchaseOrder?.vendorId || "" }));
    }
    if (grn.projectRef) {
      setForm((prev) => ({ ...prev, projectRef: grn.projectRef || "" }));
    }

    const itemByName = new Map(inventoryItems.map((i) => [normalizeKey(i.name), i]));
    const imported = (grn.items || []).map((it) => {
      const match = itemByName.get(normalizeKey(it.itemName));
      return {
        description: it.itemName,
        itemId: match?.id,
        grnItemId: it.id,
        quantity: Number(it.quantity) || "",
        unit: it.unit || match?.unit || "",
        unitCost: Number(it.unitCost) || "",
        total: "",
      } satisfies BillLine;
    });

    if (imported.length === 0) {
      toast.error("Selected GRN has no items to import.");
      return;
    }

    setLines(imported);
    toast.success(`Imported ${imported.length} line(s) from GRN ${grn.grnNumber}.`);
  };

  async function submit() {
    if (!form.billNumber || !form.vendorId || !form.projectRef || !form.billDate) {
      toast.error("Bill number, vendor, project, and bill date are required");
      return;
    }
    const cleanedLines = lines
      .map((l, idx) => {
        const qty = Number(l.quantity);
        const unitCost = Number(l.unitCost);
        const computedTotal =
          Number.isFinite(qty) && qty > 0 && Number.isFinite(unitCost) && unitCost >= 0
            ? qty * unitCost
            : computedLineTotals[idx] || 0;

        return {
          description: l.description.trim(),
          itemId: l.itemId || undefined,
          grnItemId: l.grnItemId || undefined,
          quantity: Number.isFinite(qty) && qty > 0 ? qty : undefined,
          unit: (l.unit || "").trim() || undefined,
          unitCost: Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : undefined,
          total: computedTotal,
        };
      })
      .filter((l) => l.description && Number.isFinite(l.total) && l.total >= 0);

    if (cleanedLines.length === 0) {
      toast.error("Add at least one bill line");
      return;
    }

    const payload = {
      billNumber: form.billNumber,
      vendorId: form.vendorId,
      projectRef: form.projectRef,
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
      onOpenChange={handleOpenChange}
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="importGrn">Import from GRN (optional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="importGrn"
                className="w-full md:w-auto min-w-[280px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
                value={selectedGrnId}
                onChange={(e) => setSelectedGrnId(e.target.value)}
              >
                <option value="">Select GRN...</option>
                {grns
                  .filter((g) => g.status !== "VOID")
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.grnNumber} ({String(g.status || "").toUpperCase()}) —{" "}
                      {new Date(g.receivedDate).toLocaleDateString()}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={importFromGrn}
                disabled={!selectedGrnId}
              >
                Import Lines
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              For stock purchases: use PO → GRN → Vendor Bill (this screen). Expenses are non-stock only in Phase 1.
            </p>
          </div>

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
            <Label>Project (required)</Label>
            <ProjectAutoComplete
              value={form.projectRef}
              onChange={(value) => setForm((prev) => ({ ...prev, projectRef: value }))}
              placeholder="Select project..."
            />
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
              <div className="text-xs text-muted-foreground">
                Use qty + unit cost for item lines. For service lines, fill description + total.
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              Add Line
            </Button>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-12 items-end">
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    placeholder="e.g., PLC + HMI supply"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs">Item (opt)</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                    value={line.itemId || ""}
                    onChange={(e) => updateLineItem(idx, e.target.value)}
                  >
                    <option value="">(service / no item)</option>
                    {inventoryItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={String(line.quantity ?? "")}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={line.unit || ""}
                    onChange={(e) => updateLine(idx, "unit", e.target.value)}
                    placeholder="pcs"
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs">Unit Cost</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={String(line.unitCost ?? "")}
                    onChange={(e) => updateLine(idx, "unitCost", e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs">Total</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={String(computedLineTotals[idx] || 0)}
                    onChange={(e) => updateLine(idx, "total", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={
                      Number(line.quantity) > 0 &&
                      Number.isFinite(Number(line.quantity)) &&
                      Number.isFinite(Number(line.unitCost))
                    }
                    required
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
