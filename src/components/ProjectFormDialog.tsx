"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectFormDialog({ open, onOpenChange }: ProjectFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    clientName: "",
    startDate: "",
    endDate: "",
    budget: "",
    totalExpense: "",
    totalIncome: "",
    pendingRecovery: "",
    status: "ACTIVE",
  });

  async function submit() {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          clientName: form.clientName || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          budget: form.budget ? parseFloat(form.budget) : 0,
          totalExpense: form.totalExpense ? parseFloat(form.totalExpense) : 0,
          totalIncome: form.totalIncome ? parseFloat(form.totalIncome) : 0,
          pendingRecovery: form.pendingRecovery ? parseFloat(form.pendingRecovery) : 0,
          status: form.status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      toast.success("Project created successfully!");
      
      // Reset form
      setForm({
        name: "",
        clientName: "",
        startDate: "",
        endDate: "",
        budget: "",
        totalExpense: "",
        totalIncome: "",
        pendingRecovery: "",
        status: "ACTIVE",
      });
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
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
      description="Add a new project to track income, expenses, and profitability"
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
            <Label htmlFor="clientName">Client Name (Optional)</Label>
            <Input
              id="clientName"
              placeholder="Acme Corp"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date (Optional)</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
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
            <Label htmlFor="budget">Budget (PKR)</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
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
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalExpense">Total Expense (PKR)</Label>
            <Input
              id="totalExpense"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.totalExpense}
              onChange={(e) => setForm({ ...form, totalExpense: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalIncome">Total Income (PKR)</Label>
            <Input
              id="totalIncome"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.totalIncome}
              onChange={(e) => setForm({ ...form, totalIncome: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pendingRecovery">Pending Recovery (PKR)</Label>
            <Input
              id="pendingRecovery"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.pendingRecovery}
              onChange={(e) => setForm({ ...form, pendingRecovery: e.target.value })}
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
    </FormDialog>
  );
}
