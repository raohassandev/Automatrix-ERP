"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { format } from "date-fns";
import ProjectAutoComplete from "./ProjectAutoComplete";
import { Textarea } from "./ui/textarea";
import PaymentModeAutoComplete from "./PaymentModeAutoComplete";

type DuplicateExpense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
};

type CategoryMeta = {
  name: string;
  maxAmount: number | null;
  enforceStrict: boolean;
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
    paymentSource: "COMPANY_DIRECT",
    companyAccountId: "",
    project: "",
    receiptUrl: "",
    receiptFileId: "",
    remarks: "",
    categoryRequest: "",
    expenseType: "COMPANY",
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItems, setDuplicateItems] = useState<DuplicateExpense[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const res = await fetch("/api/categories?type=expense");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load categories");
        }
        const list = Array.isArray(data.categories) ? data.categories : [];
        if (cancelled) return;
        setCategories(
          list.map((item: { name: string; maxAmount?: number | null; enforceStrict?: boolean }) => ({
            name: item.name,
            maxAmount: typeof item.maxAmount === "number" ? item.maxAmount : null,
            enforceStrict: Boolean(item.enforceStrict),
          }))
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading categories:", error);
      } finally {
        if (cancelled) return;
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/company-accounts")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        const active = list.filter((a: { isActive?: boolean }) => a.isActive !== false);
        setAccounts(active);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.name === form.category),
    [categories, form.category]
  );
  const parsedAmount = Number(form.amount);

  async function submit(ignoreDuplicate = false) {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    try {
      if (!form.project) {
        if (form.expenseType !== "OWNER_PERSONAL") {
          toast.error("Project is required for company expenses");
          return;
        }
      }
      if (form.paymentSource === "COMPANY_ACCOUNT" && !form.companyAccountId) {
        toast.error("Please select a company account");
        return;
      }
      if (
        selectedCategory?.enforceStrict &&
        typeof selectedCategory.maxAmount === "number" &&
        Number.isFinite(parsedAmount) &&
        parsedAmount > selectedCategory.maxAmount
      ) {
        toast.error(`Amount exceeds the allowed limit of PKR ${selectedCategory.maxAmount} for this category.`);
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
          paymentSource: form.paymentSource,
          companyAccountId: form.paymentSource === "COMPANY_ACCOUNT" ? form.companyAccountId : undefined,
          expenseType: form.expenseType,
          project: form.project,
          receiptUrl: form.receiptUrl || undefined,
          receiptFileId: form.receiptFileId || undefined,
          remarks: form.remarks || undefined,
          categoryRequest: form.categoryRequest || undefined,
          ignoreDuplicate,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : {};

      if (res.status === 409 && data.duplicates) {
        // Show duplicate warning
        setDuplicateItems(data.duplicates);
        setDuplicateModalOpen(true);
        return;
      }

      if (!res.ok) {
        const fieldErrors: Record<string, string[] | undefined> | undefined = data?.details?.fieldErrors;
        const fieldErrorMsg = fieldErrors
          ? Object.entries(fieldErrors)
              .filter(([, v]) => v && v.length)
              .map(([k, v]) => `${k}: ${(v || []).join(", ")}`)
              .join(" | ")
          : "";
        const detailsMsg =
          typeof data?.details === "string" ? data.details : "";

        throw new Error(fieldErrorMsg || detailsMsg || data.error || "Failed to submit expense");
      }

      toast.success("Expense submitted successfully!");
      
      // Reset form
      setDate(undefined);
      setForm({
        description: "",
        category: "",
        amount: "",
        paymentMode: "",
        paymentSource: "COMPANY_DIRECT",
        companyAccountId: "",
        project: "",
        receiptUrl: "",
        receiptFileId: "",
        remarks: "",
        categoryRequest: "",
        expenseType: "COMPANY",
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
              <Input
                id="date"
                type="date"
                value={date ? format(date, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setDate(value ? new Date(value) : undefined);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="__loading" disabled>
                      {categoriesLoading ? "Loading..." : "No categories"}
                    </SelectItem>
                  ) : (
                    categories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                {categoriesLoading ? (
                  "Loading category limits..."
                ) : selectedCategory?.maxAmount ? (
                  <>
                    Limit: PKR {selectedCategory.maxAmount}{" "}
                    {selectedCategory.enforceStrict ? "(strict)" : "(guideline)"}
                  </>
                ) : (
                  "No category limit set."
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMode">Payment Mode</Label>
              <PaymentModeAutoComplete
                value={form.paymentMode}
                onChange={(value) => setForm({ ...form, paymentMode: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentSource">Payment Source</Label>
              <Select
                value={form.paymentSource}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    paymentSource: value,
                    companyAccountId: value === "COMPANY_ACCOUNT" ? prev.companyAccountId : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY_DIRECT">Company Direct</SelectItem>
                  <SelectItem value="COMPANY_ACCOUNT">Company Account</SelectItem>
                  <SelectItem value="EMPLOYEE_WALLET">Employee Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.paymentSource === "COMPANY_ACCOUNT" ? (
              <div className="space-y-2">
                <Label htmlFor="companyAccountId">Company Account</Label>
                <Select
                  value={form.companyAccountId}
                  onValueChange={(value) => setForm({ ...form, companyAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cash/bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="expenseType">Expense Type</Label>
              <Select
                value={form.expenseType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    expenseType: value,
                    project: value === "OWNER_PERSONAL" ? "" : prev.project,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company Expense</SelectItem>
                  <SelectItem value="OWNER_PERSONAL">Owner Personal</SelectItem>
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
                placeholder={form.expenseType === "OWNER_PERSONAL" ? "Personal expense (no project)" : "Select project"}
                disabled={form.expenseType === "OWNER_PERSONAL"}
              />
            </div>

            <div className="space-y-2 md:col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Stock purchases</div>
              <div>
                Phase 1 rule: Expenses are non-stock only. For stock purchases use Procurement -&gt; PO/GRN/Vendor
                Bill.
              </div>
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                placeholder="Add notes or details"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="categoryRequest">Request New Category (Optional)</Label>
              <Input
                id="categoryRequest"
                placeholder="If the category is missing, request a new one"
                value={form.categoryRequest}
                onChange={(e) => setForm({ ...form, categoryRequest: e.target.value })}
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
