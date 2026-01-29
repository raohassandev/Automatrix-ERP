"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import ApprovalActions from "./ApprovalActions";

interface Approval {
  id: string;
  date: Date;
  category: string;
  description: string;
  amount: any;
  project?: string;
  submittedBy: { id: string; email: string; name?: string };
  currentWalletBalance: any;
  requiredApprovalLevel: string;
}

interface HistoryItem {
  id: string;
  date: Date;
  category: string;
  amount: any;
  status: string;
  submittedBy: { email: string; name?: string };
  approvedBy?: { email: string; name?: string };
  updatedAt: Date;
}

export default function ApprovalQueue({
  approvals,
  history,
}: {
  approvals: Approval[];
  history: HistoryItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const handleSelectAll = () => {
    if (selectedIds.size === approvals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvals.map((a) => a.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Approve ${selectedIds.size} expense(s)?\n\nThis will deduct amounts from employee wallets.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch("/api/approvals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: Array.from(selectedIds),
          action: "APPROVE",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to bulk approve");
      }

      alert(
        `✅ Bulk approval complete!\n\nSuccessful: ${data.results.successful.length}\nFailed: ${data.results.failed.length}`
      );
      setSelectedIds(new Set());
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      alert("❌ " + (err instanceof Error ? err.message : "An error occurred"));
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkRejectReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    try {
      const res = await fetch("/api/approvals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: Array.from(selectedIds),
          action: "REJECT",
          reason: bulkRejectReason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to bulk reject");
      }

      alert(
        `✅ Bulk rejection complete!\n\nSuccessful: ${data.results.successful.length}\nFailed: ${data.results.failed.length}`
      );
      setSelectedIds(new Set());
      setShowBulkReject(false);
      setBulkRejectReason("");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      alert("❌ " + (err instanceof Error ? err.message : "An error occurred"));
    }
  };

  if (approvals.length === 0) {
    return (
      <>
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="mt-2 text-gray-600">
            No pending approvals at the moment. Great job!
          </p>
          
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800"
            >
              View Recent Approval History
            </button>
          )}
        </div>

        {showHistory && <ApprovalHistory history={history} />}
      </>
    );
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 p-4">
          <div className="text-sm font-medium text-blue-900">
            {selectedIds.size} expense(s) selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkApprove}
              disabled={pending}
              className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {pending ? "Processing..." : "Approve Selected"}
            </button>
            <button
              onClick={() => setShowBulkReject(true)}
              disabled={pending}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Approvals Table */}
      <div className="mb-6 overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === approvals.length && approvals.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Wallet Impact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {approvals.map((expense) => {
              const currentBalance = parseFloat(expense.currentWalletBalance.toString());
              const amount = parseFloat(expense.amount.toString());
              const afterBalance = currentBalance - amount;
              const isInsufficient = afterBalance < 0;
              const isLow = afterBalance < 10000 && afterBalance >= 0;

              return (
                <tr
                  key={expense.id}
                  className={`hover:bg-gray-50 ${
                    selectedIds.has(expense.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(expense.id)}
                      onChange={() => handleSelectOne(expense.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">
                      {expense.submittedBy.name || expense.submittedBy.email}
                    </div>
                    <div className="text-gray-500">{expense.submittedBy.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {expense.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={expense.description}>
                      {expense.description}
                    </div>
                    {expense.project && (
                      <div className="mt-1 text-xs text-gray-500">
                        Project: {expense.project}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatMoney(amount)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-600">
                        Current: <span className="font-medium">{formatMoney(currentBalance)}</span>
                      </div>
                      <div
                        className={`font-medium ${
                          isInsufficient
                            ? "text-red-600"
                            : isLow
                            ? "text-yellow-600"
                            : "text-green-600"
                        }`}
                      >
                        After: {formatMoney(afterBalance)}
                      </div>
                      {isInsufficient && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          Insufficient
                        </div>
                      )}
                      {isLow && !isInsufficient && (
                        <div className="text-xs text-yellow-600">⚠️ Low balance</div>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <ApprovalLevelBadge level={expense.requiredApprovalLevel} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <ApprovalActions
                      expenseId={expense.id}
                      amount={amount}
                      employeeName={expense.submittedBy.name || expense.submittedBy.email}
                      currentBalance={currentBalance}
                      afterBalance={afterBalance}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Approval History Toggle */}
      {history.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {showHistory ? "Hide" : "Show"} Recent Approval History ({history.length})
          </button>
        </div>
      )}

      {showHistory && <ApprovalHistory history={history} />}

      {/* Bulk Reject Modal */}
      {showBulkReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Reject {selectedIds.size} Expense(s)
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Please provide a reason for rejecting these expenses.
            </p>
            <textarea
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="mb-4 w-full rounded border border-gray-300 p-2 text-sm"
              rows={4}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowBulkReject(false);
                  setBulkRejectReason("");
                }}
                disabled={pending}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReject}
                disabled={pending || !bulkRejectReason.trim()}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Rejecting..." : "Confirm Reject All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ApprovalLevelBadge({ level }: { level: string }) {
  const badges: Record<string, { color: string; text: string }> = {
    AUTO: { color: "bg-gray-100 text-gray-800", text: "Auto" },
    MANAGER: { color: "bg-blue-100 text-blue-800", text: "Manager" },
    FINANCE_MANAGER: { color: "bg-purple-100 text-purple-800", text: "Finance Mgr" },
    CEO: { color: "bg-red-100 text-red-800", text: "CEO" },
  };

  const badge = badges[level] || badges.AUTO;

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badge.color}`}>
      {badge.text}
    </span>
  );
}

function ApprovalHistory({ history }: { history: HistoryItem[] }) {
  return (
    <div className="mt-6 rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent Approval History</h3>
      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border-l-4 border-gray-200 bg-gray-50 p-3"
            style={{
              borderLeftColor: item.status === "APPROVED" ? "#10b981" : "#ef4444",
            }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                    item.status === "APPROVED"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-sm font-medium text-gray-900">{item.category}</span>
                <span className="text-sm text-gray-600">
                  {formatMoney(parseFloat(item.amount.toString()))}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {item.submittedBy.name || item.submittedBy.email} •{" "}
                {new Date(item.updatedAt).toLocaleDateString()}{" "}
                {new Date(item.updatedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
