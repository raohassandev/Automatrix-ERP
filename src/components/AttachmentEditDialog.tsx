"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import Image from "next/image";

type AttachmentEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
  };
};

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export function AttachmentEditDialog({ open, onOpenChange, attachment }: AttachmentEditDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: attachment.type || "",
    fileName: attachment.fileName || "",
    fileUrl: attachment.fileUrl || "",
  });

  const isImage = IMAGE_EXT.some((ext) => form.fileUrl.toLowerCase().includes(ext));

  useEffect(() => {
    if (open) {
      setForm({
        type: attachment.type || "",
        fileName: attachment.fileName || "",
        fileUrl: attachment.fileUrl || "",
      });
    }
  }, [open, attachment]);

  async function submit() {
    try {
      if (!form.type || !form.fileName || !form.fileUrl) {
        toast.error("Type, file name, and URL are required");
        return;
      }
      const res = await fetch(`/api/attachments/${attachment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          fileName: form.fileName,
          fileUrl: form.fileUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update attachment");
      }
      toast.success("Attachment updated");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update attachment");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Attachment"
      description="Update attachment details"
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
            <select
              id="type"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
              <option value="Invoice">Invoice</option>
              <option value="Project">Project</option>
              <option value="Client">Client</option>
              <option value="Employee">Employee</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              value={form.fileName}
              onChange={(e) => setForm({ ...form, fileName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="fileUrl">File URL</Label>
            <Input
              id="fileUrl"
              value={form.fileUrl}
              onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
              required
            />
          </div>
        </div>
        {form.fileUrl ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">Preview</div>
            <div className="mt-2">
              {isImage ? (
                <Image
                  src={form.fileUrl}
                  alt={form.fileName || "Attachment preview"}
                  width={320}
                  height={320}
                  className="max-h-48 w-auto rounded border bg-background"
                  unoptimized
                />
              ) : (
                <a className="text-primary hover:underline" href={form.fileUrl} target="_blank" rel="noreferrer">
                  Open attachment
                </a>
              )}
            </div>
          </div>
        ) : null}
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
