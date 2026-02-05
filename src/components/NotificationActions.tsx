"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { NotificationEditDialog } from "./NotificationEditDialog";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: string;
  message: string;
  status: string;
};

export function NotificationActions({
  notification,
  canEdit,
}: {
  notification: Notification;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isUnread = notification.status === "UNREAD" || notification.status === "NEW";

  const toggleStatus = () => {
    startTransition(async () => {
      try {
        const nextStatus = isUnread ? "READ" : "UNREAD";
        const res = await fetch(`/api/notifications/${notification.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update status");
        }
        toast.success(`Marked as ${nextStatus.toLowerCase()}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update status");
      }
    });
  };

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={toggleStatus} disabled={pending}>
              {pending ? "Saving..." : isUnread ? "Mark Read" : "Mark Unread"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/notifications/${notification.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <NotificationEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          notification={notification}
        />
      ) : null}
    </>
  );
}
