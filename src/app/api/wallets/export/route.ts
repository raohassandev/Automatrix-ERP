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

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "employees.view_all");
  const canEdit = await requirePermission(session.user.id, "employees.edit_wallet");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");

  if (!canViewAll && !canEdit && !canViewOwn) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const sourceType = (searchParams.get("sourceType") || "").trim();
  const employeeId = (searchParams.get("employeeId") || "").trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await logAudit({
    action: "EXPORT_WALLET_LEDGER_CSV",
    entity: "Export",
    entityId: "wallet-ledger",
    newValue: JSON.stringify({
      route: "/api/wallets/export",
      query: searchParams.toString(),
      scope: canViewAll || canEdit ? "ALL" : "OWN",
    }),
    userId: session.user.id,
  });

  const ownEmployee = session.user.email
    ? await prisma.employee.findUnique({ where: { email: session.user.email }, select: { id: true } })
    : null;

  let baseWhere: Record<string, unknown> = {};
  if (!canViewAll && !canEdit) {
    baseWhere = ownEmployee?.id ? { employeeId: ownEmployee.id } : { employeeId: "__none__" };
  }
  if (employeeId) {
    if (!canViewAll && !canEdit && employeeId !== ownEmployee?.id) {
      baseWhere = { employeeId: "__none__" };
    } else {
      baseWhere = { ...baseWhere, employeeId };
    }
  }

  const where: Record<string, unknown> = { ...baseWhere };
  if (search) {
    where.AND = [
      baseWhere,
      {
        OR: [
          { reference: { contains: search, mode: "insensitive" as const } },
          { employee: { name: { contains: search, mode: "insensitive" as const } } },
          { employee: { email: { contains: search, mode: "insensitive" as const } } },
        ],
      },
    ];
  }
  if (type) where.type = type;
  if (sourceType) where.sourceType = sourceType;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const ledgers = await prisma.walletLedger.findMany({
    where,
    include: {
      employee: true,
      companyAccount: { select: { id: true, name: true, type: true } },
      postedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows = [
    [
      "Date",
      "Employee",
      "Email",
      "Type",
      "Amount",
      "Balance",
      "Source",
      "Company Account",
      "Reference",
      "Posted By",
    ],
    ...ledgers.map((entry) => [
      entry.date.toISOString(),
      entry.employee?.name || "",
      entry.employee?.email || "",
      entry.type,
      entry.amount.toString(),
      entry.balance.toString(),
      entry.sourceType || "",
      entry.companyAccount?.name || "",
      entry.reference || "",
      entry.postedBy?.name || entry.postedBy?.email || "",
    ]),
  ];

  const csv = toCsv(rows);
  const filename = `wallet_ledger_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
