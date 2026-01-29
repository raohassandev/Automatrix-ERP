'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import ExpenseForm from "@/components/ExpenseForm";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import PaginationControls from "@/components/PaginationControls";
import SearchInput from "@/components/SearchInput";
import DateRangePicker from "@/components/DateRangePicker";
import SortableHeader from "@/components/SortableHeader";
import ColumnVisibilityToggle from "@/components/ColumnVisibilityToggle";

const COLUMNS = [
  { key: 'date', label: 'Date', visible: true },
  { key: 'description', label: 'Description', visible: true },
  { key: 'category', label: 'Category', visible: true },
  { key: 'amount', label: 'Amount', visible: true },
  { key: 'status', label: 'Status', visible: true },
];

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [columns, setColumns] = useState(COLUMNS);

  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch(`/api/expenses?${searchParams.toString()}`);
      const data = await res.json();
      setExpenses(data.data);
      setTotalPages(Math.ceil(data.total / 25));
    };
    fetchExpenses();
  }, [searchParams]);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Expenses</h1>
            <p className="mt-2 text-gray-600">
              A list of all expenses in the system.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <SearchInput placeholder="Search expenses..." />
            <ColumnVisibilityToggle columns={columns} onVisibilityChange={setColumns} />
            <Link
              href={`/api/expenses/export?${searchParams.toString()}`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </Link>
          </div>
        </div>
      </div>

      <ExpenseForm />

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
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
                          ? new Date(expense[col.key]).toLocaleDateString()
                          : col.key === 'amount'
                          ? formatMoney(Number(expense[col.key]))
                          : expense[col.key]}
                      </td>
                    ) : null
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
