import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import DateRangePicker from "@/components/DateRangePicker";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import QueryInput from "@/components/QueryInput";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default async function APAgingPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    page?: string;
    from?: string;
    to?: string;
    vendor?: string;
    overdue?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">AP Aging</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = searchParams;
  const search = (params.search || "").trim();
  const vendor = (params.vendor || "").trim();
  const overdueOnly = (params.overdue || "").trim().toLowerCase() === "true";
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;
  const from = params.from;
  const to = params.to;

  const canExport = await requirePermission(session.user.id, "reports.export");
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (vendor) exportParams.set("vendor", vendor);
  if (overdueOnly) exportParams.set("overdue", "true");
  const exportQuery = exportParams.toString();

  const where: import("@prisma/client").Prisma.VendorBillWhereInput = {
    status: "POSTED",
  };
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.billDate = range;
  }
  if (vendor) {
    where.vendor = {
      name: { contains: vendor, mode: "insensitive" as const },
    };
  }
  if (search) {
    where.OR = [
      { billNumber: { contains: search, mode: "insensitive" as const } },
      { notes: { contains: search, mode: "insensitive" as const } },
      { vendor: { name: { contains: search, mode: "insensitive" as const } } },
    ];
  }

  const [bills, total] = await Promise.all([
    prisma.vendorBill.findMany({
      where,
      orderBy: { billDate: "desc" },
      include: { vendor: true },
      skip,
      take,
    }),
    prisma.vendorBill.count({ where }),
  ]);

  const billIds = bills.map((b) => b.id);
  const paidGroups =
    billIds.length === 0
      ? []
      : await prisma.vendorPaymentAllocation.groupBy({
          by: ["vendorBillId"],
          where: {
            vendorBillId: { in: billIds },
            vendorPayment: { status: "POSTED" },
          },
          _sum: { amount: true },
        });

  const paidMap = new Map(paidGroups.map((g) => [g.vendorBillId, Number(g._sum.amount || 0)]));

  const today = new Date();
  const rows = bills
    .map((bill) => {
      const totalAmount = Number(bill.totalAmount);
      const paidAmount = paidMap.get(bill.id) || 0;
      const outstanding = Math.max(0, totalAmount - paidAmount);

      // Phase 1 default: Net 30 if dueDate isn't provided.
      const dueDate = bill.dueDate ? bill.dueDate : addDays(bill.billDate, 30);
      const overdue = outstanding > 0 && today.getTime() > dueDate.getTime();

      return {
        id: bill.id,
        billNumber: bill.billNumber,
        vendorName: bill.vendor.name,
        billDate: bill.billDate,
        dueDate,
        totalAmount,
        paidAmount,
        outstanding,
        overdue,
      };
    })
    .filter((row) => (overdueOnly ? row.overdue : true));

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += r.totalAmount;
      acc.paid += r.paidAmount;
      acc.outstanding += r.outstanding;
      acc.overdue += r.overdue ? r.outstanding : 0;
      return acc;
    },
    { total: 0, paid: 0, outstanding: 0, overdue: 0 }
  );

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AP Aging</h1>
            <p className="mt-2 text-muted-foreground">
              Posted vendor bills and their outstanding balances (finance-lite, allocations only).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search bill/vendor/notes..." />
            </div>
            <div className="min-w-[200px]">
              <QueryInput param="vendor" placeholder="Filter vendor..." />
            </div>
            <div className="min-w-[140px]">
              <QueryInput param="overdue" placeholder="overdue=true" />
            </div>
            {canExport ? (
              <a
                href={`/api/reports/ap/export${exportQuery ? `?${exportQuery}` : ""}`}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Posted Bills</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.total)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Paid (POSTED payments)</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.paid)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Outstanding</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.outstanding)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Overdue Outstanding</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.overdue)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Bill #</th>
                <th className="py-2">Vendor</th>
                <th className="py-2">Bill Date</th>
                <th className="py-2">Due Date</th>
                <th className="py-2">Total</th>
                <th className="py-2">Paid</th>
                <th className="py-2">Outstanding</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2 font-medium">{row.billNumber}</td>
                  <td className="py-2">{row.vendorName}</td>
                  <td className="py-2">{row.billDate.toISOString().slice(0, 10)}</td>
                  <td className="py-2">{row.dueDate.toISOString().slice(0, 10)}</td>
                  <td className="py-2">{formatMoney(row.totalAmount)}</td>
                  <td className="py-2">{formatMoney(row.paidAmount)}</td>
                  <td className="py-2">{formatMoney(row.outstanding)}</td>
                  <td className="py-2">
                    {row.overdue ? <span className="text-red-600">OVERDUE</span> : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No posted vendor bills found.</div>
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

