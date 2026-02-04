"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ClientFormDialog } from "./ClientFormDialog";
import { toast } from "sonner";
import ClientAutoComplete from "./ClientAutoComplete";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: string;
    projectId?: string;
    name?: string;
    clientId?: string;
    startDate?: string;
    contractValue?: string;
    endDate?: string;
    status?: string;
  };
  onCreated?: () => void;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  initialData,
  onCreated,
}: ProjectFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientRefreshKey, setClientRefreshKey] = useState(0);
  const [form, setForm] = useState({
    projectId: "",
    name: "",
    clientId: "",
    startDate: "",
    endDate: "",
    contractValue: "",
    status: "ACTIVE",
  });
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (open) {
      setClientRefreshKey((prev) => prev + 1);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialData) return;
    setForm((prev) => ({
      ...prev,
      projectId: initialData.projectId ?? prev.projectId,
      name: initialData.name ?? prev.name,
      clientId: initialData.clientId ?? prev.clientId,
      startDate: initialData.startDate ?? prev.startDate,
      endDate: initialData.endDate ?? prev.endDate,
      contractValue: initialData.contractValue ?? prev.contractValue,
      status: initialData.status ?? prev.status,
    }));
  }, [open, initialData]);

  async function submit() {
    try {
      const payload = isEdit
        ? {
            name: form.name,
            clientId: form.clientId,
            endDate: form.endDate || undefined,
            contractValue: form.contractValue ? parseFloat(form.contractValue) : 0,
            status: form.status,
          }
        : {
            projectId: form.projectId,
            name: form.name,
            clientId: form.clientId,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
            contractValue: form.contractValue ? parseFloat(form.contractValue) : 0,
            status: form.status,
          };

      const res = await fetch(isEdit ? `/api/projects/${initialData?.id}` : "/api/projects", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} project`);
      }

      toast.success(`Project ${isEdit ? "updated" : "created"} successfully!`);
      
      // Reset form
      setForm({
        projectId: "",
        name: "",
        clientId: "",
        startDate: "",
        endDate: "",
        contractValue: "",
        status: "ACTIVE",
      });
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
      onCreated?.();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error(error instanceof Error ? error.message : `Failed to ${isEdit ? "update" : "create"} project`);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
        title={isEdit ? "Edit Project" : "Create Project"}
        description={isEdit ? "Update project details" : "Add a new project linked to a client"}
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
            <Label htmlFor="projectId">Project ID</Label>
            <Input
              id="projectId"
              placeholder="From quotation system"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              disabled={isEdit}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="Website Redesign"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client</Label>
            <ClientAutoComplete
              value={form.clientId}
              onChange={(value) => setForm({ ...form, clientId: value })}
              refreshKey={clientRefreshKey}
              placeholder="Select a client"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setClientDialogOpen(true)}>
              Create Client
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              disabled={isEdit}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date (Optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractValue">Total Budget (PKR)</Label>
            <Input
              id="contractValue"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.contractValue}
              onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (isEdit ? "Updating..." : "Creating...") : isEdit ? "Update Project" : "Create Project"}
          </Button>
        </div>
      </form>
      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={() => setClientRefreshKey((prev) => prev + 1)}
      />
    </FormDialog>
  );
}
