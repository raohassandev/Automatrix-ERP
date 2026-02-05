import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();


  if (!session?.user?.id) {
    return redirect('/login');
  }

  const canView = await requirePermission(session.user.id, "reports.view_all");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to the audit log.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let logs = [];
  let total = 0;
  try {
  const where: import("@prisma/client").Prisma.AuditLogWhereInput = search
    ? {
        OR: [
          { action: { contains: search, mode: "insensitive" as const } },
          { entity: { contains: search, mode: "insensitive" as const } },
          { entityId: { contains: search, mode: "insensitive" as const } },
          { reason: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {};

    const [logsResult, totalResult] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    logs = logsResult;
    total = totalResult;
  } catch (error) {
    console.error("Error fetching audit logs:", error);
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
        <div className="min-w-[220px]">
          <SearchInput placeholder="Search audit log..." />
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
