import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

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

  const canViewAll = await requirePermission(userId, "income.view_all");
  const canViewOwn = await requirePermission(userId, "income.view_own");

  if (!canViewAll && !canViewOwn) {
    return new Response("Forbidden", { status: 403 });
  }

  await logAudit({
    action: "EXPORT_INCOME_CSV",
    entity: "Export",
    entityId: "income",
    newValue: JSON.stringify({ route: "/api/income/export", scope: canViewAll ? "ALL" : "OWN" }),
    userId,
  });

  const entries = await prisma.income.findMany({
    where: canViewAll ? {} : { addedById: userId },
    include: {
      addedBy: { select: { email: true, name: true } },
      approvedBy: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    [
      "Date",
      "Source",
      "Category",
      "Amount",
      "Payment Mode",
      "Project",
      "Status",
      "Approval Level",
      "Added By",
      "Approved By",
      "Invoice ID",
      "Receipt URL",
      "Created At",
    ],
    ...entries.map((entry) => [
      entry.date.toISOString(),
      entry.source,
      entry.category,
      entry.amount.toString(),
      entry.paymentMode,
      entry.project || "",
      entry.status,
      entry.approvalLevel || "",
      entry.addedBy?.email || "",
      entry.approvedBy?.email || "",
      entry.invoiceId || "",
      entry.receiptUrl || "",
      entry.createdAt.toISOString(),
    ]),
  ];

  const csv = toCsv(rows);
  const filename = `income_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
