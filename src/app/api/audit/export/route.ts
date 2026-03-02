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
        .join(","),
    )
    .join("\n");
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const action = (searchParams.get("action") || "").trim();
  const entity = (searchParams.get("entity") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const where: import("@prisma/client").Prisma.AuditLogWhereInput = {};
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { reason: { contains: search, mode: "insensitive" } },
    ];
  }
  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  await logAudit({
    action: "EXPORT_AUDIT_CSV",
    entity: "Export",
    entityId: "audit-log",
    newValue: JSON.stringify({ route: "/api/audit/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const csv = toCsv([
    ["Time", "Action", "Entity", "Entity ID", "Field", "Reason", "User ID"],
    ...rows.map((row) => [
      row.createdAt.toISOString(),
      row.action,
      row.entity,
      row.entityId,
      row.field || "",
      row.reason || "",
      row.userId || "",
    ]),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=audit_log_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
