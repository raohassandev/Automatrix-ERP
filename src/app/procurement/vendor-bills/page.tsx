import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { formatMoney } from "@/lib/format";
import { VendorBillCreateButton } from "@/components/VendorBillCreateButton";
import { VendorBillActions } from "@/components/VendorBillActions";

export default async function VendorBillsPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Vendor Bills</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to procurement.</p>
      </div>
    );
  }

  const search = (searchParams.search || "").trim();
  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const where: import("@prisma/client").Prisma.VendorBillWhereInput = search
    ? {
        OR: [
          { billNumber: { contains: search, mode: "insensitive" as const } },
          { vendor: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.vendorBill.findMany({
      where,
      orderBy: { billDate: "desc" },
      include: { vendor: true, lines: true, allocations: { include: { vendorPayment: true } } },
      skip,
      take,
    }),
    prisma.vendorBill.count({ where }),
  ]);

  const bills = rows.map((bill) => {
    const paid = bill.allocations
      .filter((a) => a.vendorPayment.status === "POSTED")
      .reduce((sum, a) => sum + Number(a.amount), 0);
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      vendorName: bill.vendor.name,
      billDate: bill.billDate.toISOString(),
      dueDate: bill.dueDate ? bill.dueDate.toISOString() : null,
      status: bill.status,
      totalAmount: Number(bill.totalAmount),
      paidAmount: paid,
      lineCount: bill.lines.length,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Vendor Bills</h1>
            <p className="mt-2 text-muted-foreground">AP (finance-lite): bills awaiting payment allocations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search bill or vendor..." />
            </div>
            {canEdit ? <VendorBillCreateButton /> : null}
          </div>
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
                <th className="py-2">Due</th>
                <th className="py-2">Lines</th>
                <th className="py-2">Status</th>
                <th className="py-2">Total</th>
                <th className="py-2">Paid</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b">
                  <td className="py-2 font-medium">{bill.billNumber}</td>
                  <td className="py-2">{bill.vendorName}</td>
                  <td className="py-2">{new Date(bill.billDate).toLocaleDateString()}</td>
                  <td className="py-2">{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "-"}</td>
                  <td className="py-2">{bill.lineCount}</td>
                  <td className="py-2">{bill.status}</td>
                  <td className="py-2">{formatMoney(bill.totalAmount)}</td>
                  <td className="py-2">{formatMoney(bill.paidAmount)}</td>
                  <td className="py-2">{canEdit ? <VendorBillActions billId={bill.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bills.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No vendor bills found.</div>
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

