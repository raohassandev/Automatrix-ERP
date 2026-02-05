"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

type NotificationEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: {
    id: string;
    type: string;
    message: string;
    status: string;
  };
};

export function NotificationEditDialog({
  open,
  onOpenChange,
  notification,
}: NotificationEditDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: notification.type || "",
    message: notification.message || "",
    status: notification.status === "NEW" ? "UNREAD" : notification.status || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        type: notification.type || "",
        message: notification.message || "",
        status: notification.status === "NEW" ? "UNREAD" : notification.status || "",
      });
    }
  }, [open, notification]);

  async function submit() {
    try {
      const res = await fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          message: form.message,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update notification");
      }
      toast.success("Notification updated");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update notification");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Notification"
      description="Update notification details"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input
              id="type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
