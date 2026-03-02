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
import { hasPermission, type RoleName } from "@/lib/permissions";

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

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div>Loading expenses...</div>}>
      <ExpensesPageContent />
    </Suspense>
  );
}

function ExpensesPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [columns, setColumns] = useState(COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const canCreate = hasPermission(roleName, "expenses.submit");
  const canEditAny = hasPermission(roleName, "expenses.edit");
  const canMarkPaid = hasPermission(roleName, "expenses.mark_paid");
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

  const summary = expenses.reduce(
    (acc, row) => {
      const amount = Number(row.amount || 0);
      acc.total += amount;
      if (row.status.startsWith("PENDING")) acc.pending += amount;
      if (row.status === "APPROVED") acc.approved += amount;
      if (row.status === "PAID") acc.paid += amount;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, paid: 0 },
  );

  const selectableApproved = expenses.filter((row) => row.status === "APPROVED").map((row) => row.id);
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
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Expenses</h1>
            <p className="mt-2 text-muted-foreground">
              A list of all expenses in the system.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              param="paymentSource"
              placeholder="All sources"
              options={[
                { label: "Company Direct", value: "COMPANY_DIRECT" },
                { label: "Company Account", value: "COMPANY_ACCOUNT" },
                { label: "Employee Wallet", value: "EMPLOYEE_WALLET" },
              ]}
            />
            <ColumnVisibilityToggle columns={columns} onVisibilityChange={setColumns} />
            <Link
              href={`/api/expenses/export?${searchParams.toString()}`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export CSV
            </Link>
            {canCreate ? (
              <PageCreateButton label="Submit Expense" formType="expense" />
            ) : null}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Total (Page)</div>
            <div className="text-xl font-semibold text-sky-800">{formatMoney(summary.total)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">Pending (Page)</div>
            <div className="text-xl font-semibold text-amber-800">{formatMoney(summary.pending)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Approved (Page)</div>
            <div className="text-xl font-semibold text-emerald-800">{formatMoney(summary.approved)}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="text-sm text-indigo-700">Paid (Page)</div>
            <div className="text-xl font-semibold text-indigo-800">{formatMoney(summary.paid)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
          Expense rule: expenses are non-stock only. Material purchasing must flow through Procurement (PO → GRN → Vendor Bill).
        </div>
        {canMarkPaid ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
            <div className="text-sm text-muted-foreground">
              Selected approved expenses: {selectedIds.size}
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
                {allApprovedSelected ? "Clear Approved" : "Select All Approved"}
              </Button>
              <Button
                size="sm"
                onClick={bulkMarkPaid}
                disabled={bulkPending || selectedIds.size === 0}
              >
                {bulkPending ? "Posting..." : "Bulk Mark Paid"}
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
                        disabled={expense.status !== "APPROVED"}
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
                          ? formatMoney(Number(expense.amount))
                          : col.key === 'description'
                          ? expense.description
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
                { label: "Category", value: expense.category },
                { label: "Type", value: expense.expenseType || "-" },
                { label: "Category Request", value: expense.categoryRequest || "-" },
                { label: "Remarks", value: expense.remarks || "-" },
                { label: "Project", value: expense.project || "-" },
                { label: "Source", value: expense.paymentSource || "-" },
                { label: "Account", value: expense.companyAccountName || "-" },
                { label: "Amount", value: formatMoney(Number(expense.amount)) },
                { label: "Status", value: `${expense.status}${expense.inventoryLedgerId ? " (LEGACY)" : ""}` },
                { label: "Date", value: new Date(expense.date).toLocaleDateString() },
              ]}
              actions={
                <ExpenseActions
                  expense={expense}
                  canEditAny={canEditAny}
                  currentUserId={currentUserId}
                  canMarkPaid={canMarkPaid}
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
