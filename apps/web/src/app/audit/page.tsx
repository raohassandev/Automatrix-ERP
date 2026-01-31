import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';

export default async function AuditPage() {
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

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="mt-2 text-muted-foreground">Latest 100 actions.</p>
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
    </div>
  );
}
