import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  if (!canViewAll && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Expense</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view this expense entry.</p>
      </div>
    );
  }

  const { id } = await params;
  const entry = await prisma.expense.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      companyAccount: { select: { id: true, name: true, type: true } },
    },
  });
  if (!entry) return notFound();
  if (!canViewAll && entry.submittedById !== session.user.id) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Expense</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view this expense entry.</p>
      </div>
    );
  }

  const shownAmount =
    entry.approvedAmount && (entry.status === "APPROVED" || entry.status === "PARTIALLY_APPROVED" || entry.status === "PAID")
      ? Number(entry.approvedAmount)
      : Number(entry.amount);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Expense Detail</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entry ID: {entry.id}</p>
          </div>
          <Link
            href="/expenses"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Expenses
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Stat label="Amount" value={formatMoney(shownAmount)} />
          <Stat label="Status" value={entry.status} />
          <Stat label="Date" value={new Date(entry.date).toLocaleDateString()} />
          <Stat label="Category" value={entry.category} />
          <Stat label="Type" value={entry.expenseType || "COMPANY"} />
          <Stat label="Project" value={entry.project || "-"} />
          <Stat label="Payment Mode" value={entry.paymentMode} />
          <Stat label="Payment Source" value={entry.paymentSource || "-"} />
          <Stat label="Company Account" value={entry.companyAccount?.name || "-"} />
          <Stat label="Submitted By" value={entry.submittedBy?.name || entry.submittedBy?.email || "-"} />
          <Stat label="Approved By" value={entry.approvedBy?.name || entry.approvedBy?.email || "-"} />
        </div>
        <div className="mt-6 rounded-lg border bg-muted/30 p-4">
          <div className="text-xs font-medium text-muted-foreground">Description</div>
          <div className="mt-2 whitespace-pre-wrap text-sm">{entry.description}</div>
        </div>
        {entry.remarks ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <div className="text-xs font-medium text-muted-foreground">Remarks</div>
            <div className="mt-2 whitespace-pre-wrap text-sm">{entry.remarks}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

