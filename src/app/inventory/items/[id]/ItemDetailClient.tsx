"use client";

import * as React from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { ItemDetailData, ItemDetailTab } from "@/lib/item-detail-policy";

function tabLabel(tab: ItemDetailTab) {
  switch (tab) {
    case "activity":
      return "Activity";
    case "ledger":
      return "Ledger";
    case "onhand":
      return "On-hand";
    case "documents":
      return "Documents";
  }
}

export function ItemDetailClient({ detail }: { detail: ItemDetailData }) {
  const tabs = (Object.keys(detail.policy.tabs) as ItemDetailTab[]).filter((t) => detail.policy.tabs[t]);
  const [active, setActive] = React.useState<ItemDetailTab>(tabs[0] || "onhand");

  React.useEffect(() => {
    if (!detail.policy.tabs[active]) {
      setActive(tabs[0] || "onhand");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.policy.role]);

  const prevLedgerHref =
    detail.ledger.page > 1 ? `/inventory/items/${detail.header.id}?ledgerPage=${detail.ledger.page - 1}` : null;
  const nextLedgerHref =
    detail.ledger.page < detail.ledger.totalPages
      ? `/inventory/items/${detail.header.id}?ledgerPage=${detail.ledger.page + 1}`
      : null;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{detail.header.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Category: {detail.header.category}</span>
              <span>UOM: {detail.header.unit}</span>
              <span>Available: {detail.header.availableQty.toLocaleString()}</span>
              <span>Min Stock: {detail.header.minStock ?? "-"}</span>
              <span>Reorder Level: {detail.header.reorderLevel ?? "-"}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Role: <span className="font-medium text-foreground">{detail.policy.role}</span>
          </div>
        </div>
      </div>

      {/* Tabs: buttons on desktop, select on mobile */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="md:hidden">
          <label className="text-sm text-muted-foreground">Section</label>
          <select
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={active}
            onChange={(e) => setActive(e.target.value as ItemDetailTab)}
          >
            {tabs.map((t) => (
              <option key={t} value={t}>
                {tabLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden md:flex md:flex-wrap md:gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActive(t)}
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium",
                active === t ? "border-foreground/20 bg-accent" : "border-border hover:bg-accent/60",
              ].join(" ")}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {active === "activity" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chronological, source-linked item movements.</p>
          <div className="mt-4 space-y-3">
            {detail.activity.length === 0 ? (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              detail.activity.slice(0, 100).map((row, idx) => (
                <div key={`${row.at}-${idx}`} className="flex items-start justify-between gap-4 border-b pb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {row.href ? (
                        <Link className="underline underline-offset-2" href={row.href}>
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(row.at).toLocaleString()} • {row.type}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{row.quantity.toLocaleString()} qty</div>
                    {typeof row.amount === "number" ? (
                      <div className="font-medium">{formatMoney(row.amount)}</div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {active === "ledger" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Ledger</h2>
              <p className="mt-1 text-sm text-muted-foreground">InventoryLedger movements (paged).</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Page {detail.ledger.page} / {detail.ledger.totalPages}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Warehouse</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Ref</th>
                  {detail.policy.canViewUnitCosts ? <th className="py-2 text-right">Unit Cost</th> : null}
                  {detail.policy.canViewUnitCosts ? <th className="py-2 text-right">Total</th> : null}
                </tr>
              </thead>
              <tbody>
                {detail.ledger.entries.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2">{e.date}</td>
                    <td className="py-2">{e.type}</td>
                    <td className="py-2">{e.warehouse || "-"}</td>
                    <td className="py-2">{e.project || "-"}</td>
                    <td className="py-2">{e.quantity.toLocaleString()}</td>
                    <td className="py-2">
                      {e.href ? (
                        <Link className="underline underline-offset-2" href={e.href}>
                          {e.reference || "View"}
                        </Link>
                      ) : (
                        e.reference || "-"
                      )}
                    </td>
                    {detail.policy.canViewUnitCosts ? (
                      <td className="py-2 text-right">{formatMoney(Number(e.unitCost || 0))}</td>
                    ) : null}
                    {detail.policy.canViewUnitCosts ? (
                      <td className="py-2 text-right">{formatMoney(Number(e.total || 0))}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail.ledger.entries.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No ledger entries.</div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            {prevLedgerHref ? (
              <Link className="rounded-md border px-3 py-2 text-sm hover:bg-accent" href={prevLedgerHref}>
                Prev
              </Link>
            ) : (
              <span />
            )}
            {nextLedgerHref ? (
              <Link className="rounded-md border px-3 py-2 text-sm hover:bg-accent" href={nextLedgerHref}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      ) : null}

      {active === "onhand" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">On-hand</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quantities by warehouse (costs only if permitted).</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Warehouse</th>
                  <th className="py-2">Qty</th>
                  {detail.policy.canViewUnitCosts ? <th className="py-2 text-right">Value</th> : null}
                </tr>
              </thead>
              <tbody>
                {detail.onHand.map((r) => (
                  <tr key={r.warehouseId || r.warehouseName} className="border-b">
                    <td className="py-2">{r.warehouseName}</td>
                    <td className="py-2">{r.quantity.toLocaleString()}</td>
                    {detail.policy.canViewUnitCosts ? (
                      <td className="py-2 text-right">{formatMoney(Number(r.value || 0))}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.onHand.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No on-hand rows.</div>
          ) : null}
        </div>
      ) : null}

      {active === "documents" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Source documents linked from ledger references.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Type</th>
                  <th className="py-2">Number</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.map((d) => (
                  <tr key={`${d.type}-${d.number}`} className="border-b">
                    <td className="py-2">{d.type}</td>
                    <td className="py-2 font-medium">
                      <Link className="underline underline-offset-2" href={d.href}>
                        {d.number}
                      </Link>
                    </td>
                    <td className="py-2">{d.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.documents.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No documents found.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

