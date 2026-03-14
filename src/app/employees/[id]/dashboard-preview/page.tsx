import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import Link from "next/link";

function resolveExpenseAmount(expense: { status: string; amount: number | { toString(): string }; approvedAmount: number | { toString(): string } | null }) {
  if ((expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED" || expense.status === "PAID") && expense.approvedAmount) {
    return Number(expense.approvedAmount);
  }
  return Number(expense.amount);
}

export default async function EmployeeDashboardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [canViewAll, canViewClientPreview] = await Promise.all([
    requirePermission(session.user.id, "employees.view_all"),
    requirePermission(session.user.id, "employees.view_client_preview"),
  ]);
  if (!canViewAll || !canViewClientPreview) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Dashboard Preview</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have access to client-facing preview.
        </p>
      </div>
    );
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
  });
  if (!employee) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Dashboard Preview</h1>
        <p className="mt-2 text-muted-foreground">Employee not found.</p>
      </div>
    );
  }

  const user = await prisma.user.findUnique({ where: { email: employee.email }, select: { id: true } });
  const targetUserId = user?.id;

  const [assignments, walletEntries, expenses, expenseCounts] = await Promise.all([
    targetUserId
      ? prisma.projectAssignment.findMany({
          where: { userId: targetUserId },
          select: { project: { select: { id: true, projectId: true, name: true, status: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.walletLedger.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: "desc" },
      take: 10,
    }),
    targetUserId
      ? prisma.expense.findMany({
          where: { submittedById: targetUserId },
          orderBy: { date: "desc" },
          take: 10,
          select: {
            id: true,
            date: true,
            description: true,
            category: true,
            amount: true,
            approvedAmount: true,
            status: true,
            project: true,
          },
        })
      : Promise.resolve([]),
    targetUserId
      ? prisma.expense.groupBy({
          by: ["status"],
          where: { submittedById: targetUserId },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const walletBalance = Number(employee.walletBalance || 0);
  const walletHold = Number(employee.walletHold || 0);
  const walletAvailable = walletBalance - walletHold;
  const expenseStatusMap = new Map(expenseCounts.map((row) => [row.status, row._count._all]));
  const assignedProjects = assignments.map((a) => a.project);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Dashboard Preview</h1>
        <p className="mt-2 text-muted-foreground">
          Read-only view for {employee.name} ({employee.email}). This does not switch your login session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Wallet Balance</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletBalance)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">On Hold</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletHold)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletAvailable)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["PENDING_L1", "PENDING_L2", "PENDING_L3", "PARTIALLY_APPROVED", "APPROVED", "PAID"].map((status) => (
          <div key={status} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">{status.replace("_", " ")}</div>
            <div className="mt-2 text-xl font-semibold">{expenseStatusMap.get(status) || 0}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Assigned Projects</h2>
          <div className="mt-4 space-y-3">
            {assignedProjects.length === 0 ? (
              <div className="text-sm text-muted-foreground">No project assignments.</div>
            ) : (
              assignedProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b pb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      <Link className="underline underline-offset-2" href={`/projects/${p.id}`}>
                        {p.projectId} — {p.name}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Status: {p.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Recent Wallet Activity</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {walletEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="py-2">{entry.type}</td>
                    <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                    <td className="py-2">{entry.reference || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const usedAmount = resolveExpenseAmount(exp);
                  return (
                    <tr key={exp.id} className="border-b">
                      <td className="py-2">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="py-2">{exp.description}</td>
                      <td className="py-2">{exp.project || "-"}</td>
                      <td className="py-2">{formatMoney(usedAmount)}</td>
                      <td className="py-2">{exp.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
