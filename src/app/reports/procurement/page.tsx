import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import DateRangePicker from "@/components/DateRangePicker";
import QueryInput from "@/components/QueryInput";
import { resolveProjectId } from "@/lib/projects";

export default async function ProcurementReportPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    page?: string;
    from?: string;
    to?: string;
    project?: string;
    vendor?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Procurement Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;
  const from = params.from;
  const to = params.to;
  const projectFilter = (params.project || "").trim();
  const vendorFilter = (params.vendor || "").trim();

  const canExport = await requirePermission(session.user.id, "reports.export");
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (projectFilter) exportParams.set("project", projectFilter);
  if (vendorFilter) exportParams.set("vendor", vendorFilter);
  const exportQuery = exportParams.toString();

  // Phase 1 single-spine: stock truth is InventoryLedger only (posted GRNs).
  // Expenses are non-stock only and intentionally excluded here.
  const ledgerWhere: Record<string, unknown> = { type: "PURCHASE", sourceType: "GRN" };
  if (projectFilter) {
    const resolvedProject = await resolveProjectId(projectFilter);
    const projectValues = [projectFilter];
    if (resolvedProject && resolvedProject !== projectFilter) projectValues.push(resolvedProject);
    ledgerWhere.project = { in: projectValues };
  }
  if (!canViewAll && !canViewTeam) {
    ledgerWhere.userId = session.user.id;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    ledgerWhere.date = range;
  }
  if (search) {
    ledgerWhere.OR = [
      { reference: { contains: search, mode: "insensitive" as const } },
      { project: { contains: search, mode: "insensitive" as const } },
    ];
  }

  const [ledgerEntries, ledgerTotal, totalLedgerCount] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where: ledgerWhere,
      orderBy: { date: "desc" },
      skip,
      take,
      include: { item: { select: { name: true, unit: true } } },
    }),
    prisma.inventoryLedger.aggregate({ where: ledgerWhere, _sum: { total: true } }),
    prisma.inventoryLedger.count({ where: ledgerWhere }),
  ]);

  const ledgerSum = Number(ledgerTotal._sum.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalLedgerCount / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Procurement Report</h1>
            <p className="mt-2 text-muted-foreground">
              Phase 1 truthful view: stock-in activity sourced from InventoryLedger (GRN postings only).
              {vendorFilter ? " (Vendor filter applies to PO/GRN exports, not ledger rows.)" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search reference/project..." />
            </div>
            <div className="min-w-[200px]">
              <QueryInput param="project" placeholder="Filter project..." />
            </div>
            <div className="min-w-[200px]">
              <QueryInput param="vendor" placeholder="Filter vendor..." />
            </div>
            {canExport ? (
              <>
                <a
                  href={`/api/reports/procurement/export?type=ledger${exportQuery ? `&${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export Stock-in
                </a>
                <a
                  href={`/api/reports/procurement/po-export${exportQuery ? `?${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export POs
                </a>
                <a
                  href={`/api/reports/procurement/grn-export${exportQuery ? `?${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export GRNs
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Stock-in Value</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(ledgerSum)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Stock-in Records</div>
          <div className="mt-2 text-xl font-semibold">{totalLedgerCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Phase 1 rule</div>
          <div className="mt-2 text-sm text-foreground">
            Stock purchases must use Procurement (PO → GRN → Vendor Bill → Vendor Payment). Expenses are non-stock only.
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Stock-in Ledger (GRN postings)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Unit</th>
                <th className="py-2">Total</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Project</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.item?.name || "Item"}</td>
                  <td className="py-2">{Number(entry.quantity)}</td>
                  <td className="py-2">{entry.item?.unit || ""}</td>
                  <td className="py-2">{formatMoney(Number(entry.total))}</td>
                  <td className="py-2">{entry.reference || "-"}</td>
                  <td className="py-2">{entry.project || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ledgerEntries.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">No stock-in entries found.</div>
        ) : null}
      </div>

      <PaginationControls currentPage={page} totalPages={totalPages} />
    </div>
  );
}
