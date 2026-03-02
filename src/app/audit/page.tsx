import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import DateRangePicker from "@/components/DateRangePicker";
import QuerySelect from "@/components/QuerySelect";
import Link from "next/link";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; action?: string; entity?: string; from?: string; to?: string };
}) {
  const session = await auth();


  if (!session?.user?.id) {
    return redirect('/login');
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to the audit log.</p>
      </div>
    );
  }

  const params = searchParams;
  const search = (params.search || "").trim();
  const action = (params.action || "").trim();
  const entity = (params.entity || "").trim();
  const from = (params.from || "").trim();
  const to = (params.to || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let logs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string;
    reason: string | null;
    createdAt: Date;
  }> = [];
  let total = 0;
  let actionOptions: Array<{ label: string; value: string }> = [];
  let entityOptions: Array<{ label: string; value: string }> = [];
  let hasLoadError = false;
  const exportUrl = `/api/audit/export?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString()}`;

  try {
    const where: import("@prisma/client").Prisma.AuditLogWhereInput = {};
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" as const } },
        { entity: { contains: search, mode: "insensitive" as const } },
        { entityId: { contains: search, mode: "insensitive" as const } },
        { reason: { contains: search, mode: "insensitive" as const } },
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

    const [logsResult, totalResult, actionValues, entityValues] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
      prisma.auditLog.groupBy({ by: ["entity"], _count: { _all: true }, orderBy: { entity: "asc" } }),
    ]);
    logs = logsResult;
    total = totalResult;
    actionOptions = actionValues
      .map((row) => ({ label: row.action, value: row.action }))
      .slice(0, 200);
    entityOptions = entityValues
      .map((row) => ({ label: row.entity, value: row.entity }))
      .slice(0, 200);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    hasLoadError = true;
  }

  if (hasLoadError) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-2 text-muted-foreground">Error loading audit log data. Please try again later.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="mt-2 text-muted-foreground">Audit actions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search audit log..." />
          </div>
          <QuerySelect param="action" placeholder="All actions" options={actionOptions} />
          <QuerySelect param="entity" placeholder="All entities" options={entityOptions} />
          <Link
            href={exportUrl}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Export CSV
          </Link>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Time</th>
              <th className="py-2">Action</th>
              <th className="py-2">Entity</th>
              <th className="py-2">Entity ID</th>
              <th className="py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b">
                <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="py-2">{log.action}</td>
                <td className="py-2">{log.entity}</td>
                <td className="py-2">{log.entityId}</td>
                <td className="py-2">{log.reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No audit entries found.</div>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls totalPages={totalPages} currentPage={page} />
        </div>
      )}
    </div>
  );
}
