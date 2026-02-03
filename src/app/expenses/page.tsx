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
import { DeleteButton, QuickEditButton } from "@/components/TableActions";

const COLUMNS = [
  { key: 'date', label: 'Date', visible: true },
  { key: 'description', label: 'Description', visible: true },
  { key: 'category', label: 'Category', visible: true },
  { key: 'project', label: 'Project', visible: true },
  { key: 'amount', label: 'Amount', visible: true },
  { key: 'status', label: 'Status', visible: true },
];

interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  project: string;
  amount: number;
  status: string;

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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [columns, setColumns] = useState(COLUMNS);
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
            <ColumnVisibilityToggle columns={columns} onVisibilityChange={setColumns} />
            <Link
              href={`/api/expenses/export?${searchParams.toString()}`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export CSV
            </Link>
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
                          : col.key === 'project'
                          ? expense.project
                          : col.key === 'status'
                          ? (
                              <Badge variant={getStatusVariant(expense.status)}>
                                {expense.status}
                              </Badge>
                            )
                          : ''}
                      </td>
                    ) : null
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {expenses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No expenses found.</div>
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
                { label: "Project", value: expense.project },
                { label: "Amount", value: formatMoney(Number(expense.amount)) },
                { label: "Status", value: expense.status },
                { label: "Date", value: new Date(expense.date).toLocaleDateString() },
              ]}
              actions={
                <>
                  <QuickEditButton
                    url={`/api/expenses/${expense.id}`}
                    fields={{ status: "Status", paymentMode: "Payment Mode", description: "Description" }}
                  />
                  <DeleteButton url={`/api/expenses/${expense.id}`} />
                </>
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
