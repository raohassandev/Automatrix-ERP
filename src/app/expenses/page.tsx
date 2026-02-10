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
import { useSession } from "next-auth/react";
import { hasPermission, type RoleName } from "@/lib/permissions";

const COLUMNS = [
  { key: 'date', label: 'Date', visible: true },
  { key: 'description', label: 'Description', visible: true },
  { key: 'category', label: 'Category', visible: true },
  { key: 'expenseType', label: 'Type', visible: true },
  { key: 'categoryRequest', label: 'Category Request', visible: true },
  { key: 'remarks', label: 'Remarks', visible: false },
  { key: 'project', label: 'Project', visible: true },
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
  const canCreate = hasPermission(roleName, "expenses.submit");
  const canEditAny = hasPermission(roleName, "expenses.edit");
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "default";
      case "REJECTED":
        return "destructive";
      case "PAID":
        return "secondary";
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
    };
    fetchExpenses();
  }, [searchParams]);


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
                { label: "Pending", value: "PENDING" },
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
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
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
                { label: "Amount", value: formatMoney(Number(expense.amount)) },
                { label: "Status", value: `${expense.status}${expense.inventoryLedgerId ? " (LEGACY)" : ""}` },
                { label: "Date", value: new Date(expense.date).toLocaleDateString() },
              ]}
              actions={
                <ExpenseActions
                  expense={expense}
                  canEditAny={canEditAny}
                  currentUserId={currentUserId}
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
