"use client";

import * as React from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { ProjectDetailData, ProjectDetailTab } from "@/lib/project-detail-policy";

function tabLabel(tab: ProjectDetailTab) {
  switch (tab) {
    case "activity":
      return "Activity";
    case "costs":
      return "Costs";
    case "inventory":
      return "Inventory";
    case "people":
      return "People";
    case "documents":
      return "Documents";
  }
}

export function ProjectDetailClient({ detail }: { detail: ProjectDetailData }) {
  const tabs = (Object.keys(detail.policy.tabs) as ProjectDetailTab[]).filter(
    (t) => detail.policy.tabs[t],
  );
  const [active, setActive] = React.useState<ProjectDetailTab>(tabs[0] || "activity");

  React.useEffect(() => {
    if (!detail.policy.tabs[active]) {
      setActive(tabs[0] || "activity");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.policy.role]);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{detail.header.projectId}</div>
            <h1 className="mt-1 truncate text-2xl font-semibold">{detail.header.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                Client:{" "}
                <Link className="underline underline-offset-2" href={`/clients?search=${encodeURIComponent(detail.header.client.name)}`}>
                  {detail.header.client.name}
                </Link>
              </span>
              <span>Status: {detail.header.status}</span>
              <span>Start: {detail.header.startDate}</span>
              <span>End: {detail.header.endDate || "-"}</span>
              <span>
                Manager:{" "}
                {detail.header.manager ? (
                  <span className="text-foreground">{detail.header.manager.name}</span>
                ) : (
                  "-"
                )}
              </span>
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
            onChange={(e) => setActive(e.target.value as ProjectDetailTab)}
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

      {/* Content */}
      {active === "activity" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chronological, source-linked events.</p>
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
                      {new Date(row.at).toLocaleString()} {row.status ? `• ${row.status}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {typeof row.quantity === "number" ? (
                      <div className="font-medium">{row.quantity.toLocaleString()} qty</div>
                    ) : null}
                    {typeof row.amount === "number" ? (
                      <div className="font-medium">{formatMoney(row.amount)}</div>
                    ) : null}
                    {row.amount == null && (row.type === "BILL" || row.type === "PAYMENT" || row.type === "LEDGER" || row.type === "EXPENSE") ? (
                      <div className="text-xs text-muted-foreground">Masked</div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {active === "costs" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Costs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 1 truth: AP (posted bills minus posted allocations) + non-stock expenses.
          </p>
          {!detail.costs ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">AP billed (posted)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.apBilledTotal)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">AP paid (posted allocations)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.apPaidTotal)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">AP outstanding</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.apOutstanding)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Non-stock expenses (approved)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.nonStockExpensesApproved)}</div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {active === "inventory" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Inventory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Movements are sourced from InventoryLedger (Phase 1 stock truth).
          </p>
          {!detail.inventory ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              {detail.inventory.totals ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Total quantity (net)</div>
                    <div className="mt-2 text-lg font-semibold">
                      {detail.inventory.totals.quantity.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Total value (net)</div>
                    <div className="mt-2 text-lg font-semibold">
                      {formatMoney(detail.inventory.totals.value)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Date</th>
                      <th className="py-2">Item</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Unit</th>
                      <th className="py-2">Ref</th>
                      {detail.policy.canViewUnitCosts ? <th className="py-2">Unit Cost</th> : null}
                      {detail.policy.canViewUnitCosts ? <th className="py-2">Total</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.inventory.entries.map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2">{e.date}</td>
                        <td className="py-2">{e.itemName}</td>
                        <td className="py-2">{e.quantity.toLocaleString()}</td>
                        <td className="py-2">{e.unit}</td>
                        <td className="py-2">
                          {e.href ? (
                            <Link className="underline underline-offset-2" href={e.href}>
                              {e.reference || "View"}
                            </Link>
                          ) : (
                            e.reference || "-"
                          )}
                        </td>
                        {detail.policy.canViewUnitCosts ? <td className="py-2">{formatMoney(Number(e.unitCost || 0))}</td> : null}
                        {detail.policy.canViewUnitCosts ? <td className="py-2">{formatMoney(Number(e.total || 0))}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {active === "people" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">People</h2>
          <p className="mt-1 text-sm text-muted-foreground">Project assignments (role-filtered).</p>
          {!detail.people ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.people.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.email}</td>
                      <td className="py-2">{p.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {active === "documents" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Phase 1 spine documents for this project.</p>
          {!detail.documents ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Type</th>
                    <th className="py-2">Number</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.documents.map((d) => (
                    <tr key={`${d.type}-${d.number}`} className="border-b">
                      <td className="py-2">{d.type}</td>
                      <td className="py-2">
                        <Link className="underline underline-offset-2" href={d.href}>
                          {d.number}
                        </Link>
                      </td>
                      <td className="py-2">{d.status}</td>
                      <td className="py-2">{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.documents.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No documents found.</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

