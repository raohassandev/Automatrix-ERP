"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface DesignationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  initialData?: {
    id: string;
    name: string;
    description?: string | null;
    isActive?: boolean | null;
  };
}

export function DesignationFormDialog({ open, onOpenChange, onSaved, initialData }: DesignationFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    description: "",
    isActive: true,
  });
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        isActive: initialData.isActive ?? true,
      });
    } else {
      setForm({ name: "", description: "", isActive: true });
    }
  }, [open, initialData]);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Designation name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description ? form.description.trim() : undefined,
      isActive: form.isActive,
    };

    const url = isEdit ? `/api/designations/${initialData?.id}` : "/api/designations";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save designation");
      }
      toast.success(isEdit ? "Designation updated" : "Designation created");
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save designation");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Designation" : "Create Designation"}
      description="Manage designation master data."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="designation-name">Designation Name</Label>
            <Input
              id="designation-name"
              placeholder="Senior Engineer"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="designation-desc">Description</Label>
            <Textarea
              id="designation-desc"
              placeholder="Handles senior engineering responsibilities"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="designation-status">Status</Label>
            <select
              id="designation-status"
              className="rounded-md border px-3 py-2"
              value={form.isActive ? "ACTIVE" : "INACTIVE"}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === "ACTIVE" })}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Designation"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
