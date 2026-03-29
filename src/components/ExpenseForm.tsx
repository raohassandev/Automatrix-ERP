"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CategoryAutoComplete from "./CategoryAutoComplete";
import PaymentModeAutoComplete from "./PaymentModeAutoComplete";
import ProjectAutoComplete from "./ProjectAutoComplete";
import { toast } from "sonner";
import { DateField } from "./ui/date-field";

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

export default function ExpenseForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    category: "",
    amount: "",
    paymentMode: "",
    paymentSource: "COMPANY_DIRECT" as "EMPLOYEE_WALLET" | "EMPLOYEE_POCKET" | "COMPANY_DIRECT" | "COMPANY_ACCOUNT",
    companyAccountId: "",
    expenseType: "COMPANY" as "COMPANY" | "OWNER_PERSONAL",
    project: "",
    receiptUrl: "",
    receiptFileId: "",
    remarks: "",
    categoryRequest: "",
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItems, setDuplicateItems] = useState<DuplicateExpense[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [companyAccounts, setCompanyAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [receiptThreshold, setReceiptThreshold] = useState(0);

  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const res = await fetch("/api/categories?type=expense");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load categories");
        }
        const list = Array.isArray(data.categories) ? data.categories : [];
        setCategories(
          list.map((item: { name: string; maxAmount?: number | null; enforceStrict?: boolean }) => ({
            name: item.name,
            maxAmount: typeof item.maxAmount === "number" ? item.maxAmount : null,
            enforceStrict: Boolean(item.enforceStrict),
          }))
        );
      } catch (error) {
        console.error("Error loading categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/company-accounts");
        const data = await res.json();
        if (res.ok && data?.success && Array.isArray(data.data)) {
          setCompanyAccounts(data.data);
        }
      } catch {}
    };
    fetchAccounts();
  }, []);

  useEffect(() => {
    const fetchOrgSettings = async () => {
      try {
        const res = await fetch("/api/settings/organization", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data?.success) {
          setReceiptThreshold(Number(data?.data?.expenseReceiptThreshold || 0));
        }
      } catch {
        setReceiptThreshold(0);
      }
    };
    fetchOrgSettings();
  }, []);

  // Phase 1: expenses are non-stock only (no Expense -> Inventory postings).

  const selectedCategory = useMemo(
    () => categories.find((category) => category.name === form.category),
    [categories, form.category]
  );
  const parsedAmount = Number(form.amount);
  const requiresReceipt = receiptThreshold > 0 && Number.isFinite(parsedAmount) && parsedAmount >= receiptThreshold;

  async function submit(ignoreDuplicate = false) {
    if (!form.date) {
      toast.error("Expense date is required.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Description is required.");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required.");
      return;
    }
    if (!form.paymentMode.trim()) {
      toast.error("Payment mode is required.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }
    if (form.paymentSource === "COMPANY_ACCOUNT" && !form.companyAccountId) {
      toast.error("Select a company account when payment source is Company Paid (Account).");
      return;
    }
    if (requiresReceipt && !form.receiptUrl.trim() && !form.receiptFileId.trim()) {
      toast.error(`Receipt is required for expenses of PKR ${receiptThreshold.toLocaleString()} or above.`);
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
        date: form.date,
        description: form.description,
        category: form.category,
        amount: parseFloat(form.amount),
        paymentMode: form.paymentMode,
        paymentSource: form.paymentSource,
        companyAccountId: form.paymentSource === "COMPANY_ACCOUNT" ? form.companyAccountId : undefined,
        expenseType: form.expenseType,
        project: form.project || undefined,
        receiptUrl: form.receiptUrl || undefined,
        receiptFileId: form.receiptFileId || undefined,
        remarks: form.remarks || undefined,
        categoryRequest: form.categoryRequest || undefined,
        ignoreDuplicate,
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : {};

    if (!data.success) {
      if (data.requiresConfirmation && data.duplicates) {
        setDuplicateItems(data.duplicates);
        setDuplicateModalOpen(true);
        return;
      }
      toast.error(data.details || data.error || "Failed to submit expense");
      return;
    }

    toast.success("Expense submitted successfully.");
    setForm({
      date: new Date().toISOString().slice(0, 10),
      description: "",
      category: "",
      amount: "",
      paymentMode: "",
      paymentSource: "COMPANY_DIRECT",
      companyAccountId: "",
      expenseType: "COMPANY",
      project: "",
      receiptUrl: "",
      receiptFileId: "",
      remarks: "",
      categoryRequest: "",
    });
    router.refresh();
  }

  function renderDuplicates(): React.ReactNode {
    if (duplicateItems.length === 0) {
      return null; // Explicitly return null if no duplicates
    }

    return (
      <div className="mt-3 space-y-2 text-sm">
        {duplicateItems.map((dup) => (
          <div key={dup.id} className="rounded-md border px-3 py-2">
            <div className="font-medium">{dup.description}</div>
            <div className="text-muted-foreground">
              {new Date(dup.date).toLocaleDateString()} · {dup.amount} · {dup.status}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Submit Expense</h2>
      <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Fill in 4 basics: date, category, amount, and project. Use Procurement for stock/material purchases.
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DateField value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
        <CategoryAutoComplete
          value={form.category}
          onChange={(value) => setForm({ ...form, category: value })}
        />
        <div className="md:col-span-2 text-xs text-muted-foreground">
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
        <PaymentModeAutoComplete
          value={form.paymentMode}
          onChange={(value) => setForm({ ...form, paymentMode: value })}
        />
        <select
          className="rounded-md border px-3 py-2"
          value={form.paymentSource}
          onChange={(e) => setForm({ ...form, paymentSource: e.target.value as "EMPLOYEE_WALLET" | "EMPLOYEE_POCKET" | "COMPANY_DIRECT" | "COMPANY_ACCOUNT" })}
        >
          <option value="COMPANY_DIRECT">Company Paid (Direct)</option>
          <option value="COMPANY_ACCOUNT">Company Paid (Account)</option>
          <option value="EMPLOYEE_POCKET">Employee Own Pocket (Reimburse)</option>
          <option value="EMPLOYEE_WALLET">Employee Wallet</option>
        </select>
        {form.paymentSource === "COMPANY_ACCOUNT" ? (
          <select
            className="rounded-md border px-3 py-2"
            value={form.companyAccountId}
            onChange={(e) => setForm({ ...form, companyAccountId: e.target.value })}
          >
            <option value="">Select company account</option>
            {companyAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.type})
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
            Company account is not required for this payment source.
          </div>
        )}
        <select
          className="rounded-md border px-3 py-2"
          value={form.expenseType}
          onChange={(e) => {
            const nextType = e.target.value as "COMPANY" | "OWNER_PERSONAL";
            setForm((prev) => ({
              ...prev,
              expenseType: nextType,
              project: nextType === "OWNER_PERSONAL" ? "" : prev.project,
            }));
          }}
        >
          <option value="COMPANY">Company Expense</option>
          <option value="OWNER_PERSONAL">Owner Personal</option>
        </select>
        <ProjectAutoComplete
          value={form.project}
          onChange={(value) => setForm({ ...form, project: value })}
          placeholder={form.expenseType === "OWNER_PERSONAL" ? "Personal expense (no project)" : "Select project"}
          disabled={form.expenseType === "OWNER_PERSONAL"}
        />
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground md:col-span-2">
          <div className="font-medium text-foreground">Stock purchases</div>
          <div>
            Phase 1 rule: Expenses are non-stock only. For stock purchases use Procurement {"->"} PO/GRN/Vendor Bill.
          </div>
        </div>
        <input
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Amount"
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Receipt URL"
          value={form.receiptUrl}
          onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Receipt File ID (optional)"
          value={form.receiptFileId}
          onChange={(e) => setForm({ ...form, receiptFileId: e.target.value })}
        />
        {receiptThreshold > 0 ? (
          <div
            className={`rounded-md border px-3 py-2 text-xs md:col-span-2 ${
              requiresReceipt
                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {requiresReceipt
              ? `Receipt is required for this amount (threshold: PKR ${receiptThreshold.toLocaleString()}).`
              : `Receipt becomes mandatory at PKR ${receiptThreshold.toLocaleString()}.`}
          </div>
        ) : null}
        <textarea
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Remarks (optional)"
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          rows={3}
        />
        <input
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Request new category (if not in the list)"
          value={form.categoryRequest}
          onChange={(e) => setForm({ ...form, categoryRequest: e.target.value })}
        />
      </div>
      <button
        className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        onClick={() => startTransition(() => submit())}
        disabled={pending}
      >
        {pending ? "Submitting..." : "Submit"}
      </button>

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
          <button
            className="rounded-md border px-4 py-2"
            onClick={() => setDuplicateModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setDuplicateModalOpen(false);
              startTransition(() => submit(true));
            }}
          >
            Submit anyway
          </button>
        </div>
      </Modal>
    </div>
  );
}
