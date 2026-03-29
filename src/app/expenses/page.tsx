'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatMoney } from "@/lib/format";
import Link from "next/link";
import PaginationControls from "@/components/PaginationControls";
import SearchInput from "@/components/SearchInput";
import DateRangePicker from "@/components/DateRangePicker";
import SortableHeader from "@/components/SortableHeader";
import ColumnVisibilityToggle from "@/components/ColumnVisibilityToggle";
import { MobileCard } from "@/components/MobileCard";
import QuerySelect from "@/components/QuerySelect";
import { Badge } from "@/components/ui/badge";
import { ExpenseActions } from "@/components/ExpenseActions";
import { PageCreateButton } from "@/components/PageCreateButton";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { type RoleName } from "@/lib/permissions";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { CircleCheckBig, Download, FilterX, HelpCircle } from "lucide-react";
import { TablePageSkeleton } from "@/components/PageSkeletons";

const COLUMNS = [
  { key: 'date', label: 'Date', visible: true },
  { key: 'description', label: 'Description', visible: true },
  { key: 'category', label: 'Category', visible: true },
  { key: 'expenseType', label: 'Type', visible: true },
  { key: 'categoryRequest', label: 'Category Request', visible: true },
  { key: 'remarks', label: 'Remarks', visible: false },
  { key: 'project', label: 'Project', visible: true },
  { key: 'paymentSource', label: 'Source', visible: true },
  { key: 'amount', label: 'Amount', visible: true },
  { key: 'status', label: 'Status', visible: true },
];

interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  expenseType?: string | null;
  categoryRequest?: string | null;
  remarks?: string | null;
  project: string;
  amount: number;
  approvedAmount?: number | null;
  status: string;
  paymentMode: string;
  paymentSource?: string | null;
  companyAccountId?: string | null;
  companyAccountName?: string | null;
  receiptUrl?: string | null;
  receiptFileId?: string | null;
  submittedById?: string | null;
  inventoryLedgerId?: string | null;

  // Add other properties as needed based on your API response
}

interface EmployeeOption {
  id: string;
  name: string;
  status?: string;
}

interface ProjectOption {
  id: string;
  projectId: string;
  name: string;
}

interface CategoryOption {
  name: string;
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <ExpensesPageContent />
    </Suspense>
  );
}

function ExpensesPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const { canAccess } = useEffectivePermissions(roleName);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [columns, setColumns] = useState(COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const canViewAllExpenses = canAccess(["expenses.view_all"]);
  const canCreate = canAccess(["expenses.submit"]);
  const canEditAny = canAccess(["expenses.edit"]);
  const canMarkPaid = canAccess(["expenses.mark_paid"]);
  const canReopen = canAccess(["expenses.reopen_approved"]);
  const effectiveAmount = (row: Expense) => {
    if (
      (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED" || row.status === "PAID") &&
      row.approvedAmount !== null &&
      row.approvedAmount !== undefined
    ) {
      return Number(row.approvedAmount);
    }
    return Number(row.amount || 0);
  };
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "default";
      case "REJECTED":
        return "destructive";
      case "PAID":
        return "secondary";
      case "PENDING_L1":
      case "PENDING_L2":
      case "PENDING_L3":
      case "PENDING":
      default:
        return "outline";
    }
  };

  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch(`/api/expenses?${searchParams.toString()}&limit=25`);
      const data = await res.json();
      setExpenses(data.data?.expenses || []); // Access expenses from nested data object
      setTotalPages(data.data?.pagination?.totalPages || 0);
      setSelectedIds(new Set());
    };
    fetchExpenses();
  }, [searchParams]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [projectsRes, employeesRes, categoriesRes] = await Promise.all([
          fetch("/api/projects", { cache: "no-store" }),
          canViewAllExpenses ? fetch("/api/employees?status=ACTIVE", { cache: "no-store" }) : Promise.resolve(null),
          fetch("/api/categories?type=expense", { cache: "no-store" }),
        ]);
        const projectsJson = await projectsRes.json().catch(() => ({}));
        if (projectsRes.ok && Array.isArray(projectsJson?.data)) {
          setProjectOptions(projectsJson.data.map((row: ProjectOption) => ({
            id: row.id,
            projectId: row.projectId,
            name: row.name,
          })));
        }
        if (employeesRes) {
          const employeesJson = await employeesRes.json().catch(() => ({}));
          if (employeesRes.ok && Array.isArray(employeesJson?.data)) {
            setEmployeeOptions(
              employeesJson.data.map((row: { id: string; name?: string; status?: string }) => ({
                id: row.id,
                name: row.name || "Employee",
                status: row.status,
              })),
            );
          }
        }
        const categoriesJson = await categoriesRes.json().catch(() => ({}));
        if (categoriesRes.ok && Array.isArray(categoriesJson?.data)) {
          setCategoryOptions(
            categoriesJson.data.map((name: string) => ({
              name,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load expense filter options", error);
      }
    };
    loadFilterOptions();
  }, [canViewAllExpenses]);

  const summary = expenses.reduce(
    (acc, row) => {
      const amount = effectiveAmount(row);
      acc.total += amount;
      if (row.status.startsWith("PENDING")) acc.pending += amount;
      if (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED") acc.approved += amount;
      if (row.status === "PAID") acc.paid += amount;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, paid: 0 },
  );

  const selectableApproved = expenses
    .filter(
      (row) =>
        (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED") &&
        row.paymentSource !== "EMPLOYEE_WALLET",
    )
    .map((row) => row.id);
  const allApprovedSelected =
    selectableApproved.length > 0 && selectableApproved.every((id) => selectedIds.has(id));

  async function bulkMarkPaid() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkPending(true);
    try {
      const res = await fetch("/api/expenses/bulk-mark-paid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Bulk mark paid failed");
      }
      const marked = Array.isArray(json?.data?.markedPaid) ? json.data.markedPaid.length : 0;
      const skipped = Array.isArray(json?.data?.skipped) ? json.data.skipped.length : 0;
      toast.success(`Bulk mark paid completed. Marked: ${marked}, Skipped: ${skipped}`);
      const refreshRes = await fetch(`/api/expenses?${searchParams.toString()}&limit=25`);
      const refreshData = await refreshRes.json();
      setExpenses(refreshData.data?.expenses || []);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk mark paid failed");
    } finally {
      setBulkPending(false);
    }
  }


  return (
    <div className="grid gap-6 overflow-x-hidden">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-sky-500/10 p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Expenses</h1>
            <p className="mt-2 text-muted-foreground">
              Company expenses with approval status, reimbursement state, and source traceability.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/70 p-2">
            <DateRangePicker />
            <SearchInput placeholder="Search expenses..." />
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Pending L1", value: "PENDING_L1" },
                { label: "Pending L2", value: "PENDING_L2" },
                { label: "Pending L3", value: "PENDING_L3" },
                { label: "Approved", value: "APPROVED" },
                { label: "Partially Approved", value: "PARTIALLY_APPROVED" },
                { label: "Rejected", value: "REJECTED" },
                { label: "Paid", value: "PAID" },
              ]}
            />
            <QuerySelect
              param="expenseType"
              placeholder="All types"
              options={[
                { label: "Company", value: "COMPANY" },
                { label: "Owner Personal", value: "OWNER_PERSONAL" },
              ]}
            />
            <QuerySelect
              param="category"
              placeholder="All categories"
              options={categoryOptions.map((row) => ({
                value: row.name,
                label: row.name,
              }))}
            />
            <QuerySelect
              param="paymentSource"
              placeholder="All sources"
              options={[
                { label: "Company Direct", value: "COMPANY_DIRECT" },
                { label: "Company Account", value: "COMPANY_ACCOUNT" },
                { label: "Employee Own Pocket", value: "EMPLOYEE_POCKET" },
                { label: "Employee Wallet", value: "EMPLOYEE_WALLET" },
              ]}
            />
            <QuerySelect
              param="paymentMode"
              placeholder="All payment modes"
              options={[
                { label: "Cash", value: "CASH" },
                { label: "Bank", value: "BANK" },
                { label: "Card", value: "CARD" },
                { label: "Transfer", value: "TRANSFER" },
                { label: "Online", value: "ONLINE" },
                { label: "Cheque", value: "CHEQUE" },
              ]}
            />
            <QuerySelect
              param="project"
              placeholder="All projects"
              options={projectOptions.map((row) => ({
                value: row.projectId,
                label: `${row.projectId} - ${row.name}`,
              }))}
            />
            {canViewAllExpenses ? (
              <QuerySelect
                param="submittedById"
                placeholder="All employees"
                options={employeeOptions.map((row) => ({ value: row.id, label: row.name }))}
              />
            ) : null}
            <ColumnVisibilityToggle columns={columns} onVisibilityChange={setColumns} />
            <Link
              href={`/api/expenses/export?${searchParams.toString()}`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Link>
            <Link
              href="/help#feature-expenses"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              title="Expense Help"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              title="Clear filters"
            >
              <FilterX className="h-4 w-4" />
            </Link>
            {canCreate ? (
              <PageCreateButton label="Submit Expense" formType="expense" />
            ) : null}
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Filters support status, type, category, source, payment mode, project, employee, date range, and free text search.
        </div>
        <details className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-primary">
            Help: Expense Flow
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Select payment source first: company direct, company account, employee wallet, or own pocket.</li>
            <li>Own-pocket expenses become reimbursement payable after approval, then move to paid when reimbursed.</li>
            <li>Employee wallet expenses use issued advance and cannot be paid twice.</li>
            <li>Use status + source filters to review pending approvals and reimbursement queues.</li>
            {canMarkPaid ? <li>Use bulk reimburse paid only for approved payable entries.</li> : null}
          </ol>
        </details>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
            <div className="text-sm text-sky-700 dark:text-sky-300">Total (Page)</div>
            <div className="text-xl font-semibold text-sky-900 dark:text-sky-100">{formatMoney(summary.total)}</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-sm text-amber-700 dark:text-amber-300">Pending (Page)</div>
            <div className="text-xl font-semibold text-amber-900 dark:text-amber-100">{formatMoney(summary.pending)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Approved (Page)</div>
            <div className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(summary.approved)}</div>
          </div>
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
            <div className="text-sm text-indigo-700 dark:text-indigo-300">Paid (Page)</div>
            <div className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(summary.paid)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          Expense rule: expenses are non-stock only. Material purchasing must flow through Procurement (PO → GRN → Vendor Bill).
        </div>
        {canMarkPaid ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
            <div className="text-sm text-muted-foreground">
              Selected payable/approved expenses: {selectedIds.size}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (allApprovedSelected) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(selectableApproved));
                  }
                }}
                disabled={selectableApproved.length === 0}
              >
                <CircleCheckBig className="mr-1 h-4 w-4" />
                {allApprovedSelected ? "Clear Selected" : "Select All Eligible"}
              </Button>
              <Button
                size="sm"
                onClick={bulkMarkPaid}
                disabled={bulkPending || selectedIds.size === 0}
              >
                {bulkPending ? "Posting..." : "Bulk Reimburse Paid"}
              </Button>
            </div>
          </div>
        ) : null}
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {canMarkPaid ? <th className="py-2">Pick</th> : null}
                {columns.map((col) =>
                  col.visible ? (
                    <th key={col.key} className="py-2">
                      <SortableHeader label={col.label} value={col.key} />
                    </th>
                  ) : null
                )}
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b">
                  {canMarkPaid ? (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(expense.id)}
                        disabled={
                          !(
                            (expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED") &&
                            expense.paymentSource === "EMPLOYEE_POCKET"
                          )
                        }
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(expense.id);
                            else next.delete(expense.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) =>
                    col.visible ? (
                      <td key={col.key} className="py-2">
                        {col.key === 'date'
                          ? new Date(expense.date).toLocaleDateString()
                          : col.key === 'amount'
                          ? formatMoney(effectiveAmount(expense))
                          : col.key === 'description'
                          ? (
                              <Link className="font-medium text-primary underline underline-offset-2" href={`/expenses/${expense.id}`}>
                                {expense.description}
                              </Link>
                            )
                          : col.key === 'category'
                          ? expense.category
                          : col.key === 'expenseType'
                          ? expense.expenseType || "-"
                          : col.key === 'categoryRequest'
                          ? expense.categoryRequest || "-"
                          : col.key === 'remarks'
                          ? expense.remarks || "-"
                          : col.key === 'project'
                          ? expense.project || "-"
                          : col.key === 'paymentSource'
                          ? expense.paymentSource || "-"
                          : col.key === 'status'
                          ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={getStatusVariant(expense.status)}>{expense.status}</Badge>
                                {expense.inventoryLedgerId ? (
                                  <Badge variant="secondary">LEGACY</Badge>
                                ) : null}
                              </div>
                            )
                          : ''}
                      </td>
                    ) : null
                  )}
                  <td className="py-2">
                    <ExpenseActions
                      expense={expense}
                      canEditAny={canEditAny}
                      currentUserId={currentUserId}
                      canMarkPaid={canMarkPaid}
                      canReopen={canReopen}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {expenses.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No expenses found.</div>
            {canCreate ? <PageCreateButton label="Submit Expense" formType="expense" /> : null}
          </div>
        )}

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-4">
          {expenses.map((expense) => (
            <MobileCard
              key={expense.id}
              title={expense.description}
              subtitle={new Date(expense.date).toLocaleDateString()}
              fields={[
                { label: "Detail", value: <Link href={`/expenses/${expense.id}`}>Open Entry</Link> },
                { label: "Category", value: expense.category },
                { label: "Type", value: expense.expenseType || "-" },
                { label: "Category Request", value: expense.categoryRequest || "-" },
                { label: "Remarks", value: expense.remarks || "-" },
                { label: "Project", value: expense.project || "-" },
                { label: "Source", value: expense.paymentSource || "-" },
                { label: "Account", value: expense.companyAccountName || "-" },
                { label: "Amount", value: formatMoney(effectiveAmount(expense)) },
                { label: "Status", value: `${expense.status}${expense.inventoryLedgerId ? " (LEGACY)" : ""}` },
                { label: "Date", value: new Date(expense.date).toLocaleDateString() },
              ]}
              actions={
                <ExpenseActions
                  expense={expense}
                  canEditAny={canEditAny}
                  currentUserId={currentUserId}
                  canMarkPaid={canMarkPaid}
                  canReopen={canReopen}
                />
              }
            />
          ))}
        </div>

        <div className="mt-4">
          <PaginationControls
            totalPages={totalPages}
            currentPage={Number(searchParams.get('page') || 1)}
          />
        </div>
      </div>
    </div>
  );
}
