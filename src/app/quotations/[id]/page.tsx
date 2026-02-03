import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { CreateProjectFromQuoteButton } from "@/components/CreateProjectFromQuoteButton";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "quotations.view_all");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Quotation</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to quotations.</p>
      </div>
    );
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { client: true, lineItems: true },
  });

  if (!quotation) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Quotation not found</h1>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Quotation {quotation.quoteNumber}</h1>
            <p className="mt-2 text-muted-foreground">
              {quotation.client?.name || quotation.clientName || "Unknown client"} • {quotation.status || "Draft"}
            </p>
          </div>
          <CreateProjectFromQuoteButton quoteId={quotation.id} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold">Client</h2>
          <div className="text-sm">Name: {quotation.client?.name || quotation.clientName || "-"}</div>
          <div className="text-sm">Email: {quotation.clientEmail || "-"}</div>
          <div className="text-sm">Phone: {quotation.clientPhone || "-"}</div>
          <div className="text-sm">Address: {quotation.clientAddress || "-"}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold">Quote Info</h2>
          <div className="text-sm">Project Ref: {quotation.projectRef || "-"}</div>
          <div className="text-sm">Sales Engineer: {quotation.salesEngineer || "-"}</div>
          <div className="text-sm">
            Date: {quotation.voucherDate ? new Date(quotation.voucherDate).toLocaleDateString() : "-"}
          </div>
          <div className="text-sm">
            Due: {quotation.dueDate ? new Date(quotation.dueDate).toLocaleDateString() : "-"}
          </div>
          <div className="text-sm">Currency: {quotation.currency || "-"}</div>
          <div className="text-sm">Total: {formatMoney(Number(quotation.totalAmount || 0))}</div>
          <div className="text-sm">Tax: {formatMoney(Number(quotation.totalTax || 0))}</div>
          <div className="text-sm">Paid: {formatMoney(Number(quotation.paidAmount || 0))}</div>
          <div className="text-sm">Due: {formatMoney(Number(quotation.dueAmount || 0))}</div>
        </div>
      </div>

      {(quotation.notes || quotation.terms) && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
          {quotation.notes ? (
            <div>
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          ) : null}
          {quotation.terms ? (
            <div>
              <h3 className="text-sm font-semibold">Terms</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.terms}</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Line Items</h2>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Unit</th>
                <th className="py-2">Rate</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Tax</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.lineItems.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.description || item.lineItem || "-"}</td>
                  <td className="py-2">{item.quantity ? Number(item.quantity) : "-"}</td>
                  <td className="py-2">{item.unit || item.itemUnit || "-"}</td>
                  <td className="py-2">{item.rate ? formatMoney(Number(item.rate)) : "-"}</td>
                  <td className="py-2">{item.amount ? formatMoney(Number(item.amount)) : "-"}</td>
                  <td className="py-2">{item.totalTax ? formatMoney(Number(item.totalTax)) : "-"}</td>
                  <td className="py-2">{item.totalAmount ? formatMoney(Number(item.totalAmount)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {quotation.lineItems.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 text-sm space-y-1">
              <div className="font-medium">{item.description || item.lineItem || "-"}</div>
              <div>Qty: {item.quantity ? Number(item.quantity) : "-"}</div>
              <div>Unit: {item.unit || item.itemUnit || "-"}</div>
              <div>Rate: {item.rate ? formatMoney(Number(item.rate)) : "-"}</div>
              <div>Amount: {item.amount ? formatMoney(Number(item.amount)) : "-"}</div>
              <div>Tax: {item.totalTax ? formatMoney(Number(item.totalTax)) : "-"}</div>
              <div>Total: {item.totalAmount ? formatMoney(Number(item.totalAmount)) : "-"}</div>
            </div>
          ))}
        </div>

        {quotation.lineItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No line items found.</div>
        )}
      </div>
    </div>
  );
}
