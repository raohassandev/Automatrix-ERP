import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { buildExpenseWhere, readExpenseQueryFilters } from "@/lib/expenses-query";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canViewAll = await requirePermission(userId, "expenses.view_all");
  const canViewOwn = await requirePermission(userId, "expenses.view_own");

  if (!canViewAll && !canViewOwn) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filters = readExpenseQueryFilters(searchParams);

  await logAudit({
    action: "EXPORT_EXPENSES_CSV",
    entity: "Export",
    entityId: "expenses",
    newValue: JSON.stringify({ route: "/api/expenses/export", scope: canViewAll ? "ALL" : "OWN", query: searchParams.toString() }),
    userId,
  });

  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhere(filters, { canViewAll, sessionUserId: userId }),
    include: {
      submittedBy: { select: { email: true, name: true } },
      approvedBy: { select: { email: true, name: true } },
      companyAccount: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const rows = [
    [
      "Date",
      "Description",
      "Category",
      "Expense Type",
      "Project",
      "Payment Source",
      "Payment Mode",
      "Status",
      "Amount",
      "Approved Amount",
      "Company Account",
      "Submitted By",
      "Approved By",
      "Receipt URL",
      "Created At",
    ],
    ...expenses.map((expense) => [
      expense.date.toISOString(),
      expense.description,
      expense.category,
      expense.expenseType,
      expense.project || "",
      expense.paymentSource || "",
      expense.paymentMode,
      expense.status,
      Number(expense.amount),
      expense.approvedAmount ? Number(expense.approvedAmount) : "",
      expense.companyAccount?.name || "",
      expense.submittedBy?.email || expense.submittedBy?.name || "",
      expense.approvedBy?.email || expense.approvedBy?.name || "",
      expense.receiptUrl || "",
      expense.createdAt.toISOString(),
    ]),
  ];

  const csv = toCsv(rows);
  const filename = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
