"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface DepartmentFormDialogProps {
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

export function DepartmentFormDialog({ open, onOpenChange, onSaved, initialData }: DepartmentFormDialogProps) {
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
      toast.error("Department name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description ? form.description.trim() : undefined,
      isActive: form.isActive,
    };

    const url = isEdit ? `/api/departments/${initialData?.id}` : "/api/departments";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save department");
      }
      toast.success(isEdit ? "Department updated" : "Department created");
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save department");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Department" : "Create Department"}
      description="Manage department master data."
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
            <Label htmlFor="dept-name">Department Name</Label>
            <Input
              id="dept-name"
              placeholder="Engineering"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-desc">Description</Label>
            <Textarea
              id="dept-desc"
              placeholder="Main engineering team"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-status">Status</Label>
            <select
              id="dept-status"
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
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Department"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
