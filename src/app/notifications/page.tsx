import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationForm from "@/components/NotificationForm";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
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

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let notifications = [];
  let total = 0;
  try {
    const where = search
      ? {
          AND: [
            { userId: session.user.id },
            {
              OR: [
                { type: { contains: search, mode: "insensitive" } },
                { message: { contains: search, mode: "insensitive" } },
                { status: { contains: search, mode: "insensitive" } },
              ],
            },
          ],
        }
      : { userId: session.user.id };

    const [notificationsResult, totalResult] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);
    notifications = notificationsResult;
    total = totalResult;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-muted-foreground">Error loading notification data. Please try again later.</p>
      </div>
    );
  }
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Notifications</h1>
            <p className="mt-2 text-muted-foreground">Personal notifications.</p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search notifications..." />
          </div>
        </div>
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

        {notifications.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No notifications found.</div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
