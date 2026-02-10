import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { InvoiceActions } from "@/components/InvoiceActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { MobileCard } from "@/components/MobileCard";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import QuerySelect from "@/components/QuerySelect";
import { PageCreateButton } from "@/components/PageCreateButton";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; status?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canView = await requirePermission(session.user.id, "invoices.view_all");
  const canCreate = await requirePermission(session.user.id, "invoices.create");
  const canEdit = await requirePermission(session.user.id, "invoices.edit");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to invoices.</p>
      </div>
    );
  }

  const params = searchParams;
  const search = (params.search || "").trim();
  const status = (params.status || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let invoices: Array<{
    id: string;
    invoiceNo: string;
    projectId: string;
    amount: number;
    status: string;
    date: string;
    dueDate: string;
    paymentDate: string | null;
    notes: string | null;
  }> = [];
  let total = 0;
  let totalInvoiced = 0;
  let totalReceived = 0;
  let overdueCount = 0;
  
  try {
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: "insensitive" as const } },
        { projectId: { contains: search, mode: "insensitive" as const } },
        { status: { contains: search, mode: "insensitive" as const } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [
      invoicesResult,
      totalResult,
      totalSum,
      receivedSum,
      overdueTotal,
    ] = await Promise.all([
      prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({ where, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true } }),
      prisma.invoice.count({ where: { ...where, status: "OVERDUE" } }),
    ]);
    invoices = invoicesResult.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      projectId: invoice.projectId,
      amount: Number(invoice.amount),
      status: invoice.status,
      date: invoice.date.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      paymentDate: invoice.paymentDate ? invoice.paymentDate.toISOString() : null,
      notes: invoice.notes ?? null,
    }));
    total = totalResult;
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search invoices..." />
            </div>
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Draft", value: "DRAFT" },
                { label: "Sent", value: "SENT" },
                { label: "Paid", value: "PAID" },
                { label: "Overdue", value: "OVERDUE" },
              ]}
            />
            {canCreate ? <PageCreateButton label="Create Invoice" formType="invoice" /> : null}
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
                    <InvoiceActions invoice={invoice} canEdit={canEdit} />
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
              actions={<InvoiceActions invoice={invoice} canEdit={canEdit} />}
            />
          ))}
        </div>

        {invoices.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No invoices found.</div>
            {canCreate ? <PageCreateButton label="Create Invoice" formType="invoice" /> : null}
          </div>
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
