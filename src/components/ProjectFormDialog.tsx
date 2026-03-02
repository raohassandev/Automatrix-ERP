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

type UserOption = { id: string; name: string | null; email: string; role: string | null };

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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
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
    if (!open) return;
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/users/list");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load users");
        }
        setUsers(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error("Failed to load users", error);
      }
    };
    loadUsers();
  }, [open]);

  useEffect(() => {
    if (!open || !initialData?.id) return;
    const loadAssignments = async () => {
      try {
        const res = await fetch(`/api/projects/${initialData.id}/assignments`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load assignments");
        }
        const ids = Array.isArray(data.data) ? data.data.map((assignment: { userId: string }) => assignment.userId) : [];
        setSelectedUsers(ids);
      } catch (error) {
        console.error("Failed to load assignments", error);
      }
    };
    loadAssignments();
  }, [open, initialData?.id]);

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

  useEffect(() => {
    if (!open || initialData?.id) return;
    setSelectedUsers([]);
  }, [open, initialData?.id]);

  async function submit() {
    try {
      if (!form.name.trim() || !form.clientId) {
        toast.error("Project name and client are required.");
        return;
      }
      if (!isEdit && !form.projectId.trim()) {
        toast.error("Project ID is required.");
        return;
      }
      if (!isEdit && !form.startDate) {
        toast.error("Start date is required.");
        return;
      }
      if (form.contractValue !== "" && (!Number.isFinite(Number(form.contractValue)) || Number(form.contractValue) < 0)) {
        toast.error("Total budget must be a valid non-negative number.");
        return;
      }
      if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
        toast.error("End date cannot be earlier than start date.");
        return;
      }
      const payload = isEdit
        ? {
            name: form.name.trim(),
            clientId: form.clientId,
            endDate: form.endDate || undefined,
            contractValue: form.contractValue ? parseFloat(form.contractValue) : 0,
            status: form.status,
          }
        : {
            projectId: form.projectId.trim(),
            name: form.name.trim(),
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

      const projectId = isEdit ? initialData?.id : data?.data?.id;
      if (projectId) {
        try {
          await fetch(`/api/projects/${projectId}/assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignments: selectedUsers.map((userId) => ({ userId })),
            }),
          });
        } catch (assignmentError) {
          console.error("Failed to save assignments", assignmentError);
        }
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
        description={isEdit ? "Update commercial and planning details." : "Simple setup: project ID, name, client, dates, budget, and team."}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Project ID should match your quotation or commercial reference for easy tracking.
        </div>
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
              <option value="NOT_STARTED">Not Started</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Project Team (Assigned Users)</Label>
            <div className="rounded-md border px-3 py-2 max-h-40 overflow-y-auto space-y-2">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users found.</p>
              ) : (
                users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers((prev) => [...prev, user.id]);
                        } else {
                          setSelectedUsers((prev) => prev.filter((id) => id !== user.id));
                        }
                      }}
                    />
                    <span>
                      {user.name || user.email} {user.role ? `(${user.role})` : ""}
                    </span>
                  </label>
                ))
              )}
            </div>
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
