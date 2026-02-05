import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationForm from "@/components/NotificationForm";
import { NotificationActions } from "@/components/NotificationActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import QuerySelect from "@/components/QuerySelect";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canView =
    (await requirePermission(session.user.id, "notifications.view_all")) ||
    (await requirePermission(session.user.id, "dashboard.view")) ||
    (await requirePermission(session.user.id, "reports.view_all"));
  const canEdit = await requirePermission(session.user.id, "notifications.edit");
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
  const status = (params.status || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let notifications = [];
  let total = 0;
  try {
    const where: Record<string, unknown> = { userId: session.user.id };
    if (search) {
      where.AND = [
        { userId: session.user.id },
        {
          OR: [
            { type: { contains: search, mode: "insensitive" as const } },
            { message: { contains: search, mode: "insensitive" as const } },
            { status: { contains: search, mode: "insensitive" as const } },
          ],
        },
      ];
    }
    if (status) {
      where.status = status === "UNREAD" ? { in: ["UNREAD", "NEW"] } : status;
    }

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
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search notifications..." />
            </div>
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Unread", value: "UNREAD" },
                { label: "Read", value: "READ" },
              ]}
            />
            {(search || status) && (
              <a
                href="/notifications"
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Reset
              </a>
            )}
          </div>
        </div>
      </div>

      {canEdit ? <NotificationForm /> : null}

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
              {notifications.map((note) => {
                const isUnread = note.status === "UNREAD" || note.status === "NEW";
                const displayStatus = isUnread ? "UNREAD" : note.status;
                return (
                  <tr key={note.id} className={`border-b ${isUnread ? "bg-amber-50/60" : ""}`}>
                    <td className="py-2">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                        {note.type}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="max-w-xl truncate" title={note.message}>
                        {note.message}
                      </div>
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          isUnread ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </td>
                    <td className="py-2">{new Date(note.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <NotificationActions notification={note} canEdit={canEdit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {notifications.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No notifications found. {search || status ? "Try resetting filters." : null}
          </div>
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
