import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { formatMoney } from "@/lib/format";
import { VendorPaymentCreateButton } from "@/components/VendorPaymentCreateButton";
import { VendorPaymentActions } from "@/components/VendorPaymentActions";

export default async function VendorPaymentsPage({
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
        <h1 className="text-2xl font-semibold">Vendor Payments</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to procurement.</p>
      </div>
    );
  }

  const search = (searchParams.search || "").trim();
  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const where: import("@prisma/client").Prisma.VendorPaymentWhereInput = search
    ? {
        OR: [
          { paymentNumber: { contains: search, mode: "insensitive" as const } },
          { vendor: { name: { contains: search, mode: "insensitive" as const } } },
          { companyAccount: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.vendorPayment.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      include: { vendor: true, companyAccount: true, allocations: true },
      skip,
      take,
    }),
    prisma.vendorPayment.count({ where }),
  ]);

  const payments = rows.map((payment) => {
    const allocated = payment.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      vendorName: payment.vendor.name,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      method: payment.method,
      accountName: payment.companyAccount.name,
      amount: Number(payment.amount),
      allocatedAmount: allocated,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Vendor Payments</h1>
            <p className="mt-2 text-muted-foreground">Record payments and allocate against vendor bills.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search payment, vendor, account..." />
            </div>
            {canEdit ? <VendorPaymentCreateButton /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Payment #</th>
                <th className="py-2">Vendor</th>
                <th className="py-2">Date</th>
                <th className="py-2">Account</th>
                <th className="py-2">Method</th>
                <th className="py-2">Status</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Allocated</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="py-2 font-medium">{payment.paymentNumber}</td>
                  <td className="py-2">{payment.vendorName}</td>
                  <td className="py-2">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                  <td className="py-2">{payment.accountName}</td>
                  <td className="py-2">{payment.method || "-"}</td>
                  <td className="py-2">{payment.status}</td>
                  <td className="py-2">{formatMoney(payment.amount)}</td>
                  <td className="py-2">{formatMoney(payment.allocatedAmount)}</td>
                  <td className="py-2">{canEdit ? <VendorPaymentActions paymentId={payment.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No vendor payments found.</div>
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

