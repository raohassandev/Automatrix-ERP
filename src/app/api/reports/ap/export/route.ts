import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
  const vendor = (searchParams.get("vendor") || "").trim();
  const overdueOnly = (searchParams.get("overdue") || "").trim().toLowerCase() === "true";

  await logAudit({
    action: "EXPORT_AP_AGING_CSV",
    entity: "Export",
    entityId: "ap-aging",
    newValue: JSON.stringify({ route: "/api/reports/ap/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const where: import("@prisma/client").Prisma.VendorBillWhereInput = {
    status: "POSTED",
  };
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.billDate = range;
  }
  if (vendor) {
    where.vendor = { name: { contains: vendor, mode: "insensitive" as const } };
  }

  const bills = await prisma.vendorBill.findMany({
    where,
    orderBy: { billDate: "desc" },
    include: { vendor: true },
  });

  const billIds = bills.map((b) => b.id);
  const paidGroups =
    billIds.length === 0
      ? []
      : await prisma.vendorPaymentAllocation.groupBy({
          by: ["vendorBillId"],
          where: {
            vendorBillId: { in: billIds },
            vendorPayment: { status: "POSTED" },
          },
          _sum: { amount: true },
        });

  const paidMap = new Map(paidGroups.map((g) => [g.vendorBillId, Number(g._sum.amount || 0)]));
  const today = new Date();

  const rows: Array<Array<string | number | null | undefined>> = [
    ["Bill #", "Vendor", "Bill Date", "Due Date", "Total", "Paid", "Outstanding", "Overdue"],
  ];

  for (const bill of bills) {
    const totalAmount = Number(bill.totalAmount);
    const paidAmount = paidMap.get(bill.id) || 0;
    const outstanding = Math.max(0, totalAmount - paidAmount);
    const dueDate = bill.dueDate ? bill.dueDate : addDays(bill.billDate, 30);
    const overdue = outstanding > 0 && today.getTime() > dueDate.getTime();
    if (overdueOnly && !overdue) continue;

    rows.push([
      bill.billNumber,
      bill.vendor.name,
      bill.billDate.toISOString().slice(0, 10),
      dueDate.toISOString().slice(0, 10),
      formatMoney(totalAmount),
      formatMoney(paidAmount),
      formatMoney(outstanding),
      overdue ? "OVERDUE" : "OK",
    ]);
  }

  const csv = toCsv(rows);
  const filename = `ap_aging_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
