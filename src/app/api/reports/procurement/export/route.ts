import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { resolveProjectId } from "@/lib/projects";

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
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canExport = await requirePermission(session.user.id, "reports.export");
  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canExport || (!canViewAll && !canViewTeam && !canViewOwn)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "expenses";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const projectFilter = searchParams.get("project");

  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  let projectValues: string[] | null = null;
  if (projectFilter) {
    const resolvedProject = await resolveProjectId(projectFilter);
    projectValues = [projectFilter];
    if (resolvedProject && resolvedProject !== projectFilter) {
      projectValues.push(resolvedProject);
    }
  }

  if (type === "ledger") {
    const where: Record<string, unknown> = { type: "PURCHASE" };
    if (!canViewAll && !canViewTeam) {
      where.userId = session.user.id;
    }
    if (from || to) {
      where.date = range;
    }
    if (projectValues?.length) {
      where.project = { in: projectValues };
    }

    const rows = await prisma.inventoryLedger.findMany({
      where,
      orderBy: { date: "desc" },
      include: { item: { select: { name: true, unit: true } } },
    });

    const csvRows: Array<Array<string | number | null | undefined>> = [
      ["Date", "Item", "Quantity", "Unit", "Total", "Reference", "Project"],
      ...rows.map((row) => [
        row.date.toISOString().slice(0, 10),
        row.item?.name || "Item",
        Number(row.quantity),
        row.item?.unit || "",
        formatMoney(Number(row.total)),
        row.reference || "",
        row.project || "",
      ]),
    ];

    const csv = toCsv(csvRows);
    const filename = `procurement_stockin_${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  }

  const expenseWhere: Record<string, unknown> = {
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
    category: { contains: "material", mode: "insensitive" as const },
  };
  if (!canViewAll && !canViewTeam) {
    expenseWhere.submittedById = session.user.id;
  }
  if (from || to) {
    expenseWhere.date = range;
  }
  if (projectValues?.length) {
    expenseWhere.project = { in: projectValues };
  }

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
    orderBy: { date: "desc" },
    select: {
      date: true,
      category: true,
      description: true,
      project: true,
      amount: true,
      approvedAmount: true,
      status: true,
    },
  });

  const rows: Array<Array<string | number | null | undefined>> = [
    ["Date", "Category", "Description", "Project", "Amount", "Status"],
    ...expenses.map((exp) => {
      const usedAmount =
        exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount
          ? Number(exp.approvedAmount)
          : Number(exp.amount);
      return [
        exp.date.toISOString().slice(0, 10),
        exp.category,
        exp.description,
        exp.project || "",
        formatMoney(usedAmount),
        exp.status,
      ];
    }),
  ];

  const csv = toCsv(rows);
  const filename = `procurement_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
