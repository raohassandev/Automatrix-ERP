"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DatePicker } from "./ui/date-picker";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { format } from "date-fns";
import ProjectAutoComplete from "./ProjectAutoComplete";

type DuplicateExpense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
};

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseFormDialog({ open, onOpenChange }: ExpenseFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState<Date>();
  const [form, setForm] = useState({
    description: "",
    category: "",
    amount: "",
    paymentMode: "",
    project: "",
    receiptUrl: "",
    receiptFileId: "",
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItems, setDuplicateItems] = useState<DuplicateExpense[]>([]);

  async function submit(ignoreDuplicate = false) {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    try {
      if (!form.project) {
        toast.error("Project is required");
        return;
      }
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          description: form.description,
          category: form.category,
          amount: parseFloat(form.amount),
          paymentMode: form.paymentMode,
          project: form.project,
          receiptUrl: form.receiptUrl || undefined,
          receiptFileId: form.receiptFileId || undefined,
          ignoreDuplicate,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.duplicates) {
        // Show duplicate warning
        setDuplicateItems(data.duplicates);
        setDuplicateModalOpen(true);
        return;
      }

      if (!res.ok) {
        // If backend provided zod details, surface them to the user.
        const fieldErrors: Record<string, string[] | undefined> | undefined = data?.details?.fieldErrors;
        const fieldErrorMsg = fieldErrors
          ? Object.entries(fieldErrors)
              .filter(([, v]) => v && v.length)
              .map(([k, v]) => `${k}: ${(v || []).join(", ")}`)
              .join(" | ")
          : "";

        throw new Error(fieldErrorMsg || data.error || "Failed to submit expense");
      }

      toast.success("Expense submitted successfully!");
      
      // Reset form
      setDate(undefined);
      setForm({
        description: "",
        category: "",
        amount: "",
        paymentMode: "",
        project: "",
        receiptUrl: "",
        receiptFileId: "",
      });
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error submitting expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit expense");
    }
  }

  function renderDuplicates(): React.ReactNode {
    if (duplicateItems.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 space-y-2 text-sm">
        {duplicateItems.map((dup) => (
          <div key={dup.id} className="rounded-md border border-border px-3 py-2 bg-card">
            <div className="font-medium text-foreground">{dup.description}</div>
            <div className="text-muted-foreground">
              {new Date(dup.date).toLocaleDateString()} · PKR {dup.amount} · {dup.status}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Submit Expense"
        description="Add a new expense entry to the system"
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
              <Label htmlFor="date">Date</Label>
              <DatePicker
                date={date}
                onDateChange={setDate}
                placeholder="Select date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Meals">Meals</SelectItem>
                  <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Salaries">Salaries</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMode">Payment Mode</Label>
              <Select value={form.paymentMode} onValueChange={(value) => setForm({ ...form, paymentMode: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Mobile Payment">Mobile Payment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (PKR)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the expense"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <ProjectAutoComplete
                value={form.project}
                onChange={(value) => setForm({ ...form, project: value })}
                placeholder="Select project"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptUrl">Receipt URL (Optional)</Label>
              <Input
                id="receiptUrl"
                type="url"
                placeholder="https://..."
                value={form.receiptUrl}
                onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="receiptFileId">Receipt File ID (Optional)</Label>
              <Input
                id="receiptFileId"
                placeholder="File ID from upload"
                value={form.receiptFileId}
                onChange={(e) => setForm({ ...form, receiptFileId: e.target.value })}
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
              {pending ? "Submitting..." : "Submit Expense"}
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* Duplicate warning modal */}
      <Modal
        open={duplicateModalOpen}
        title="Possible duplicate expense"
        onClose={() => setDuplicateModalOpen(false)}
      >
        <p className="text-sm text-muted-foreground">
          We found similar expenses you submitted recently. Review them below.
        </p>
        {renderDuplicates()}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setDuplicateModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setDuplicateModalOpen(false);
              startTransition(() => submit(true));
            }}
          >
            Submit anyway
          </Button>
        </div>
      </Modal>
    </>
  );
}
