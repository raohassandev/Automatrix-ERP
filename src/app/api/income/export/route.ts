import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

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

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const search = (searchParams.get("search") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const source = (searchParams.get("source") || "").trim();
  const category = (searchParams.get("category") || "").trim();
  const project = (searchParams.get("project") || "").trim();
  const paymentMode = (searchParams.get("paymentMode") || "").trim();
  const addedById = (searchParams.get("addedById") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const where: Prisma.IncomeWhereInput = canViewAll ? {} : { addedById: userId };
  const andFilters: Prisma.IncomeWhereInput[] = [];

  if (search) {
    andFilters.push({
      OR: [
        { source: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { project: { contains: search, mode: "insensitive" } },
        { status: { contains: search, mode: "insensitive" } },
        { paymentMode: { contains: search, mode: "insensitive" } },
        { addedBy: { name: { contains: search, mode: "insensitive" } } },
        { addedBy: { email: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (status) andFilters.push({ status });
  if (source) andFilters.push({ source });
  if (category) andFilters.push({ category });
  if (project) andFilters.push({ project });
  if (paymentMode) andFilters.push({ paymentMode });
  if (from || to) {
    const dateRange: { gte?: Date; lte?: Date } = {};
    if (from) dateRange.gte = new Date(from);
    if (to) dateRange.lte = new Date(to);
    andFilters.push({ date: dateRange });
  }
  if (canViewAll && addedById) {
    andFilters.push({ addedById });
  }
  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const entries = await prisma.income.findMany({
    where,
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
