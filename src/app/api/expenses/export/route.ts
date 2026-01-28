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

  const canViewAll = await requirePermission(userId, "expenses.view_all");
  const canViewOwn = await requirePermission(userId, "expenses.view_own");

  if (!canViewAll && !canViewOwn) {
    return new Response("Forbidden", { status: 403 });
  }

  const expenses = await prisma.expense.findMany({
    where: canViewAll ? {} : { submittedById: userId },
    include: {
      submittedBy: { select: { email: true, name: true } },
      approvedBy: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    [
      "Date",
      "Description",
      "Category",
      "Amount",
      "Payment Mode",
      "Project",
      "Status",
      "Approval Level",
      "Approved Amount",
      "Submitted By",
      "Approved By",
      "Receipt URL",
      "Created At",
    ],
    ...expenses.map((expense) => [
      expense.date.toISOString(),
      expense.description,
      expense.category,
      expense.amount.toString(),
      expense.paymentMode,
      expense.project || "",
      expense.status,
      expense.approvalLevel || "",
      expense.approvedAmount ? expense.approvedAmount.toString() : "",
      expense.submittedBy?.email || "",
      expense.approvedBy?.email || "",
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
