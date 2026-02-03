import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { MobileCard } from "@/components/MobileCard";
import { Badge } from "@/components/ui/badge";
import InvoiceForm from "@/components/InvoiceForm";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
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

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let invoices = [];
  let projects = [];
  let total = 0;
  let totalInvoiced = 0;
  let totalReceived = 0;
  let overdueCount = 0;
  
  try {
    const where = search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: "insensitive" } },
            { projectId: { contains: search, mode: "insensitive" } },
            { status: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [
      invoicesResult,
      totalResult,
      projectsResult,
      totalSum,
      receivedSum,
      overdueTotal,
    ] = await Promise.all([
      prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.invoice.count({ where }),
      prisma.project.findMany({ orderBy: { name: "asc" }, include: { client: true } }),
      prisma.invoice.aggregate({ where, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true } }),
      prisma.invoice.count({ where: { ...where, status: "OVERDUE" } }),
    ]);
    invoices = invoicesResult;
    total = totalResult;
    projects = projectsResult;
    totalInvoiced = Number(totalSum._sum.amount || 0);
    totalReceived = Number(receivedSum._sum.amount || 0);
    overdueCount = overdueTotal;
  } catch (error) {
    console.error("Error fetching data:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-2 text-muted-foreground">Error loading data. Please try again later.</p>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID': return 'default';
      case 'SENT': return 'secondary'; 
      case 'OVERDUE': return 'destructive';
      case 'DRAFT': return 'outline';
      default: return 'outline';
    }
  };

  const totalPending = totalInvoiced - totalReceived;
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Invoice Management</h1>
            <p className="mt-2 text-muted-foreground">Track and manage your project invoices</p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search invoices..." />
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mt-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Invoiced</div>
            <div className="text-xl font-semibold text-blue-600">{formatMoney(totalInvoiced)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Received</div>
            <div className="text-xl font-semibold text-green-600">{formatMoney(totalReceived)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-xl font-semibold text-yellow-600">{formatMoney(totalPending)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Overdue</div>
            <div className="text-xl font-semibold text-red-600">{overdueCount} invoices</div>
          </div>
        </div>
      </div>

      {/* Invoice Form */}
      <InvoiceForm projects={projects.map(p => ({
        id: p.id,
        projectId: p.projectId,
        name: p.name,
        clientName: p.client?.name || "",
        contractValue: Number(p.contractValue),
        costToDate: Number(p.costToDate)
      }))} />

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
                  <td className="py-2 font-medium">{invoice.invoiceNo}</td>
                  <td className="py-2">{invoice.projectId}</td>
                  <td className="py-2 font-semibold">{formatMoney(Number(invoice.amount))}</td>
                  <td className="py-2">
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </td>
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
                { 
                  label: "Status", 
                  value: <Badge variant={getStatusBadgeVariant(invoice.status)}>
                    {invoice.status}
                  </Badge> 
                },
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

        {invoices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No invoices found.</div>
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
