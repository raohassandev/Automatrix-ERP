import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { MobileCard } from "@/components/MobileCard";

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
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to invoices.</p>
      </div>
    );
  }

  const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-2 text-muted-foreground">Invoice tracking.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
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

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-4">
          {invoices.map((invoice) => (
            <MobileCard
              key={invoice.id}
              title={invoice.invoiceNo}
              subtitle={`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`}
              fields={[
                { label: "Project", value: invoice.projectId },
                { label: "Amount", value: formatMoney(Number(invoice.amount)) },
                { label: "Status", value: invoice.status },
              ]}
              actions={
                <>
                  <QuickEditButton
                    url={`/api/invoices/${invoice.id}`}
                    fields={{ status: "Status", paymentDate: "Payment Date", dueDate: "Due Date" }}
                  />
                  <DeleteButton url={`/api/invoices/${invoice.id}`} />
                </>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
