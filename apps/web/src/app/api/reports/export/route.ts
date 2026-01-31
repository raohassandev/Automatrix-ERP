import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canExport = await requirePermission(userId, "reports.export");
  const canViewAll = await requirePermission(userId, "reports.view_all");
  const canViewTeam = await requirePermission(userId, "reports.view_team");
  const canViewOwn = await requirePermission(userId, "reports.view_own");

  if (!canExport || (!canViewAll && !canViewTeam && !canViewOwn)) {
    return new Response("Forbidden", { status: 403 });
  }

  const [expenseSum, incomeSum, projectCount, invoiceCount, pendingRecoverySum, inventoryItems] =
    await Promise.all([
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.income.aggregate({ _sum: { amount: true } }),
      prisma.project.count(),
      prisma.invoice.count(),
      prisma.project.aggregate({ _sum: { pendingRecovery: true } }),
      prisma.inventoryItem.findMany({
        where: { minStock: { gt: 0 } },
        select: { quantity: true, minStock: true, name: true },
      }),
    ]);

  const totalExpenses = Number(expenseSum._sum.amount || 0);
  const totalIncome = Number(incomeSum._sum.amount || 0);
  const lowStock = inventoryItems.filter(
    (item) => Number(item.quantity) <= Number(item.minStock)
  );

  const rows: Array<Array<string | number | null | undefined>> = [
    ["Report", "Summary"],
    ["Total Income", totalIncome],
    ["Total Expenses", totalExpenses],
    ["Projects", projectCount],
    ["Invoices", invoiceCount],
    ["Pending Recovery", Number(pendingRecoverySum._sum.pendingRecovery || 0)],
    ["Low Stock Alerts", lowStock.length],
    [],
    ["Low Stock Items", "Quantity", "Min Stock"],
    ...lowStock.map((item) => [item.name, item.quantity.toString(), item.minStock.toString()]),
  ];

  const csv = toCsv(rows);
  const filename = `reports_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
