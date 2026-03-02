import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function ExceptionsReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Exceptions Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const where: import("@prisma/client").Prisma.AuditLogWhereInput = {
    action: { startsWith: "BLOCK_" },
    ...(from || to ? { createdAt: range } : {}),
  };

  const [rows, grouped] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: { _all: true },
      orderBy: { action: "asc" },
      take: 20,
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Exceptions Report</h1>
        <p className="mt-2 text-muted-foreground">
          Blocked actions and policy exceptions captured in audit logs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="text-sm text-rose-700">Total Exceptions</div>
          <div className="mt-2 text-xl font-semibold text-rose-900">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm md:col-span-3">
          <div className="text-sm text-amber-700">Top Blocked Actions</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {grouped.map((g) => (
              <span key={g.action} className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                {g.action} ({g._count._all})
              </span>
            ))}
            {grouped.length === 0 ? <span className="text-sm text-muted-foreground">No blocked actions</span> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
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
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="py-2">{row.action}</td>
                  <td className="py-2">{row.entity}</td>
                  <td className="py-2">{row.entityId}</td>
                  <td className="py-2">{row.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="py-8 text-center text-muted-foreground">No exceptions found.</div> : null}
      </div>
    </div>
  );
}
