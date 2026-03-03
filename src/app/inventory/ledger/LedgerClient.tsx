"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import PaginationControls from "@/components/PaginationControls";
import DateRangePicker from "@/components/DateRangePicker";

const InventoryLedgerActions = dynamic(
  () => import("@/components/InventoryLedgerActions").then((mod) => mod.InventoryLedgerActions),
  { ssr: false }
);

interface LedgerEntry {
  id: string;
  date: Date;
  item: { name: string } | null;
  type: string;
  quantity: number;
  unitCost: number;
  total: number;
  project: string | null;
  reference: string | null;
  warehouseName: string | null;
}

interface LedgerClientProps {
  entries: LedgerEntry[];
  total: number;
  items: { id: string; name: string }[];
  warehouses: { id: string; name: string; isDefault: boolean }[];
  canViewCost: boolean;
  canAdjust: boolean;
  canRequest: boolean;
  searchParams: { page?: string; q?: string; type?: string; from?: string; to?: string; warehouseId?: string };
}

export function LedgerClient({
  entries,
  total,
  items,
  warehouses,
  canViewCost,
  canAdjust,
  canRequest,
  searchParams,
}: LedgerClientProps) {
  const page = Math.max(parseInt(searchParams?.page || "1", 10), 1);
  const query = (searchParams?.q || "").trim();
  const type = (searchParams?.type || "").trim();
  const warehouseId = (searchParams?.warehouseId || "").trim();
  const take = 25;
  const totalPages = Math.max(1, Math.ceil(total / take));
  const formatStableDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Inventory Ledger</h1>
            <p className="mt-2 text-muted-foreground">Stock movement history.</p>
          </div>
          <InventoryLedgerActions
            items={items}
            warehouses={warehouses}
            canViewCost={canViewCost}
            canAdjust={canAdjust}
            canRequest={canRequest}
          />
        </div>
      </div>

      <form className="rounded-xl border bg-card p-6 shadow-sm" method="get">
        <div className="flex flex-wrap gap-3 items-end">
          <DateRangePicker />
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Item, project, reference"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm font-medium">Type</label>
            <select name="type" defaultValue={type} className="mt-1 w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="SALE">SALE</option>
              <option value="PROJECT_ALLOCATION">PROJECT_ALLOCATION</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="RETURN">RETURN</option>
              <option value="TRANSFER">TRANSFER</option>
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="text-sm font-medium">Warehouse</label>
            <select
              name="warehouseId"
              defaultValue={warehouseId}
              className="mt-1 w-full rounded-md border px-3 py-2"
            >
              <option value="">All</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-black px-4 py-2 text-white">Apply</button>
          <Link
            href={`/api/inventory/ledger/export?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              ...(type ? { type } : {}),
              ...(warehouseId ? { warehouseId } : {}),
              ...(searchParams.from ? { from: searchParams.from } : {}),
              ...(searchParams.to ? { to: searchParams.to } : {}),
            }).toString()}`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Export CSV
          </Link>
        </div>
      </form>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Item</th>
                <th className="py-2">Type</th>
                <th className="py-2">Qty</th>
                {canViewCost ? <th className="py-2">Unit Cost</th> : null}
                {canViewCost ? <th className="py-2">Total</th> : null}
                <th className="py-2">Warehouse</th>
                <th className="py-2">Project</th>
                <th className="py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{formatStableDate(entry.date)}</td>
                  <td className="py-2">{entry.item?.name || "-"}</td>
                  <td className="py-2">{entry.type}</td>
                  <td className="py-2">{Number(entry.quantity)}</td>
                  {canViewCost ? (
                    <td className="py-2">{formatMoney(Number(entry.unitCost))}</td>
                  ) : null}
                  {canViewCost ? (
                    <td className="py-2">{formatMoney(Number(entry.total))}</td>
                  ) : null}
                  <td className="py-2">{entry.warehouseName || "-"}</td>
                  <td className="py-2">{entry.project || "-"}</td>
                  <td className="py-2">{entry.reference || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="border rounded-lg p-4 text-sm space-y-1">
              <div className="font-semibold">{entry.item?.name || "-"}</div>
              <div>Date: {formatStableDate(entry.date)}</div>
              <div>Type: {entry.type}</div>
              <div>Qty: {Number(entry.quantity)}</div>
              {canViewCost ? (
                <div>Unit Cost: {formatMoney(Number(entry.unitCost))}</div>
              ) : null}
              {canViewCost ? (
                <div>Total: {formatMoney(Number(entry.total))}</div>
              ) : null}
              <div>Warehouse: {entry.warehouseName || "-"}</div>
              <div>Project: {entry.project || "-"}</div>
              <div>Ref: {entry.reference || "-"}</div>
            </div>
          ))}
        </div>

        {entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No inventory movements found.</div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
