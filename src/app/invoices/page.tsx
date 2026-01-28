import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import InvoiceForm from "@/components/InvoiceForm";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canView = await requirePermission(session.user.id, "invoices.view_all");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-2 text-gray-600">You do not have access to invoices.</p>
      </div>
    );
  }

  const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-2 text-gray-600">Invoice tracking.</p>
      </div>

      <InvoiceForm />

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Invoice</th>
                <th className="py-2">Project</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Due</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b">
                  <td className="py-2">{invoice.invoiceNo}</td>
                  <td className="py-2">{invoice.projectId}</td>
                  <td className="py-2">{formatMoney(Number(invoice.amount))}</td>
                  <td className="py-2">{invoice.status}</td>
                  <td className="py-2">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <QuickEditButton
                        url={`/api/invoices/${invoice.id}`}
                        fields={{ status: "Status", paymentDate: "Payment Date", dueDate: "Due Date" }}
                      />
                      <DeleteButton url={`/api/invoices/${invoice.id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
