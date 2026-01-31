import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationForm from "@/components/NotificationForm";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canView =
    (await requirePermission(session.user.id, "dashboard.view")) ||
    (await requirePermission(session.user.id, "reports.view_all"));
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to notifications.</p>
      </div>
    );
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-muted-foreground">Personal notifications.</p>
      </div>

      <NotificationForm />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Type</th>
                <th className="py-2">Message</th>
                <th className="py-2">Status</th>
                <th className="py-2">Time</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((note) => (
                <tr key={note.id} className="border-b">
                  <td className="py-2">{note.type}</td>
                  <td className="py-2">{note.message}</td>
                  <td className="py-2">{note.status}</td>
                  <td className="py-2">{new Date(note.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <QuickEditButton
                        url={`/api/notifications/${note.id}`}
                        fields={{ status: "Status", message: "Message", type: "Type" }}
                      />
                      <DeleteButton url={`/api/notifications/${note.id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
