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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const vendor = searchParams.get("vendor");
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

  const purchaseOrderWhere: Record<string, unknown> = {};
  if (vendor) {
    purchaseOrderWhere.vendorName = { contains: vendor, mode: "insensitive" as const };
  }
  if (projectValues?.length) {
    purchaseOrderWhere.items = {
      some: {
        OR: [
          { project: { in: projectValues } },
          { project: { contains: projectFilter || "", mode: "insensitive" as const } },
        ],
      },
    };
  }

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.receivedDate = range;
  }
  if (Object.keys(purchaseOrderWhere).length > 0) {
    where.purchaseOrder = { is: purchaseOrderWhere };
  }

  const receipts = await prisma.goodsReceipt.findMany({
    where,
    orderBy: { receivedDate: "desc" },
    include: { items: true, purchaseOrder: true },
  });

  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "GRN Number",
      "PO Number",
      "Vendor",
      "Received Date",
      "Status",
      "Item",
      "Qty",
      "Unit",
      "Unit Cost",
      "Total",
    ],
  ];

  receipts.forEach((receipt) => {
    receipt.items.forEach((item) => {
      rows.push([
        receipt.grnNumber,
        receipt.purchaseOrder?.poNumber || "",
        receipt.purchaseOrder?.vendorName || "",
        receipt.receivedDate.toISOString().slice(0, 10),
        receipt.status,
        item.itemName,
        Number(item.quantity),
        item.unit || "",
        formatMoney(Number(item.unitCost)),
        formatMoney(Number(item.total)),
      ]);
    });
  });

  const csv = toCsv(rows);
  const filename = `procurement_grns_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
