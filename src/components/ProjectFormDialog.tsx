"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ClientFormDialog } from "./ClientFormDialog";
import { toast } from "sonner";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    projectId?: string;
    name?: string;
    clientId?: string;
    startDate?: string;
    contractValue?: string;
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
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    projectId: "",
    name: "",
    clientId: "",
    startDate: "",
    endDate: "",
    contractValue: "",
  });

  const loadClients = async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (res.ok) {
        setClients(data.data || []);
      } else {
        throw new Error(data.error || "Failed to fetch clients");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load clients");
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!open || !initialData) return;
    setForm((prev) => ({
      ...prev,
      projectId: initialData.projectId ?? prev.projectId,
      name: initialData.name ?? prev.name,
      clientId: initialData.clientId ?? prev.clientId,
      startDate: initialData.startDate ?? prev.startDate,
      contractValue: initialData.contractValue ?? prev.contractValue,
    }));
  }, [open, initialData]);

  async function submit() {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.projectId,
          name: form.name,
          clientId: form.clientId,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          contractValue: form.contractValue ? parseFloat(form.contractValue) : 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      toast.success("Project created successfully!");
      
      // Reset form
      setForm({
        projectId: "",
        name: "",
        clientId: "",
        startDate: "",
        endDate: "",
        contractValue: "",
      });
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
      onCreated?.();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Project"
      description="Add a new project linked to a client"
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
            <select
              id="clientId"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              required
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
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
            {pending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={loadClients}
      />
    </FormDialog>
  );
}
