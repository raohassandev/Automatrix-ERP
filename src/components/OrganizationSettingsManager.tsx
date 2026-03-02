"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type OrgSettings = {
  companyName: string;
  legalName: string;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  defaultCustomerTermsDays: number;
  defaultVendorTermsDays: number;
  expenseReceiptThreshold: number;
};

const DEFAULTS: OrgSettings = {
  companyName: "AutoMatrix ERP",
  legalName: "",
  currency: "PKR",
  timezone: "Asia/Karachi",
  fiscalYearStartMonth: 7,
  defaultCustomerTermsDays: 30,
  defaultVendorTermsDays: 30,
  expenseReceiptThreshold: 0,
};

export default function OrganizationSettingsManager() {
  const [form, setForm] = useState<OrgSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/settings/organization", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load settings");
        if (!cancelled && json?.data) {
          setForm({
            companyName: json.data.companyName || DEFAULTS.companyName,
            legalName: json.data.legalName || "",
            currency: json.data.currency || DEFAULTS.currency,
            timezone: json.data.timezone || DEFAULTS.timezone,
            fiscalYearStartMonth: Number(json.data.fiscalYearStartMonth || DEFAULTS.fiscalYearStartMonth),
            defaultCustomerTermsDays: Number(json.data.defaultCustomerTermsDays || DEFAULTS.defaultCustomerTermsDays),
            defaultVendorTermsDays: Number(json.data.defaultVendorTermsDays || DEFAULTS.defaultVendorTermsDays),
            expenseReceiptThreshold: Number(json.data.expenseReceiptThreshold || 0),
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function save() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/organization", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to save settings");
        toast.success("Organization settings updated.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save settings");
      }
    });
  }

  if (loading) {
    return <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading organization settings...</div>;
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Organization Profile & Defaults</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These defaults guide accounting, procurement, and expense forms for easier operator usage.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Company Name</Label>
          <Input
            value={form.companyName}
            onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Legal Name</Label>
          <Input
            value={form.legalName}
            onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Input
            value={form.currency}
            onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Input
            value={form.timezone}
            onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Fiscal Year Start Month (1-12)</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={form.fiscalYearStartMonth}
            onChange={(e) => setForm((p) => ({ ...p, fiscalYearStartMonth: Number(e.target.value || 1) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Expense Receipt Threshold (PKR)</Label>
          <Input
            type="number"
            min={0}
            value={form.expenseReceiptThreshold}
            onChange={(e) => setForm((p) => ({ ...p, expenseReceiptThreshold: Number(e.target.value || 0) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Default Customer Terms (days)</Label>
          <Input
            type="number"
            min={0}
            value={form.defaultCustomerTermsDays}
            onChange={(e) => setForm((p) => ({ ...p, defaultCustomerTermsDays: Number(e.target.value || 0) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Default Vendor Terms (days)</Label>
          <Input
            type="number"
            min={0}
            value={form.defaultVendorTermsDays}
            onChange={(e) => setForm((p) => ({ ...p, defaultVendorTermsDays: Number(e.target.value || 0) }))}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save Organization Settings"}
        </Button>
      </div>
    </div>
  );
}
