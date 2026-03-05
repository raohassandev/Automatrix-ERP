"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import ApprovalActions from "./ApprovalActions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Approval {
  id: string;
  type: "EXPENSE" | "INCOME";
  date: Date;
  category: string;
  description: string;
  remarks?: string | null;
  categoryRequest?: string | null;
  amount: number | string;
  project?: string;
  submittedBy: { id: string; email: string; name?: string | null };
  walletBalance: number | string;
  walletHold: number | string;
  categoryLimit?: number | null;
  categoryStrict?: boolean;
  requiredApprovalLevel: string;
  status: string;
}

interface HistoryItem {
  id: string;
  type: "EXPENSE" | "INCOME";
  date: Date;
  category: string;
  amount: number | string;
  status: string;
  submittedBy: { email: string; name?: string | null };
  approvedBy: { email: string; name?: string | null } | null;
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
  const [showBulkApprove, setShowBulkApprove] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");

  const filteredApprovals = approvals.filter((item) => {
    if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      item.category.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.project || "").toLowerCase().includes(term) ||
      item.submittedBy.email.toLowerCase().includes(term) ||
      (item.submittedBy.name || "").toLowerCase().includes(term)
    );
  });

  const handleSelectAll = () => {
    if (filteredApprovals.length === 0) return;
    const allSelected = filteredApprovals.every((item) => selectedIds.has(item.id));
    const nextSelected = new Set(selectedIds);
    if (allSelected) {
      filteredApprovals.forEach((item) => nextSelected.delete(item.id));
    } else {
      filteredApprovals.forEach((item) => nextSelected.add(item.id));
    }
    setSelectedIds(nextSelected);
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
    setShowBulkApprove(true);
  };

  const confirmBulkApprove = async () => {
    startTransition(async () => {
      try {
        const selected = approvals.filter((a) => selectedIds.has(a.id));
        const expenseIds = selected.filter((a) => a.type === "EXPENSE").map((a) => a.id);
        const incomeIds = selected.filter((a) => a.type === "INCOME").map((a) => a.id);
        const results = { successful: 0, failed: 0 };

        if (expenseIds.length > 0) {
          const res = await fetch("/api/approvals", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expenseIds,
              action: "APPROVE",
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to bulk approve expenses");
          }
          results.successful += data.results.successful.length;
          results.failed += data.results.failed.length;
        }

        if (incomeIds.length > 0) {
          const res = await fetch("/api/approvals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "APPROVE",
              incomeIds,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to approve income");
          }
          results.successful += Array.isArray(data.data) ? data.data.length : 1;
        }

        toast.success("Bulk approval complete!", {
          description: `Successful: ${results.successful}, Failed: ${results.failed}`,
        });
        setSelectedIds(new Set());
        setShowBulkApprove(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      }
    });
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkRejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    startTransition(async () => {
      try {
        const selected = approvals.filter((a) => selectedIds.has(a.id));
        const expenseIds = selected.filter((a) => a.type === "EXPENSE").map((a) => a.id);
        const incomeIds = selected.filter((a) => a.type === "INCOME").map((a) => a.id);
        const results = { successful: 0, failed: 0 };

        if (expenseIds.length > 0) {
          const res = await fetch("/api/approvals", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expenseIds,
              action: "REJECT",
              reason: bulkRejectReason,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to bulk reject expenses");
          }
          results.successful += data.results.successful.length;
          results.failed += data.results.failed.length;
        }

        if (incomeIds.length > 0) {
          for (const incomeId of incomeIds) {
            const res = await fetch("/api/approvals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "REJECT",
                incomeId,
                reason: bulkRejectReason,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Failed to reject income");
            }
            results.successful += 1;
          }
        }

        toast.success("Bulk rejection complete!", {
          description: `Successful: ${results.successful}, Failed: ${results.failed}`,
        });
        setSelectedIds(new Set());
        setShowBulkReject(false);
        setBulkRejectReason("");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      }
    });
  };

  if (approvals.length === 0) {
    return (
      <>
        <div className="rounded-lg bg-card p-12 text-center shadow">
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
          <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
          <p className="mt-2 text-muted-foreground">
            No pending approvals at the moment. Great job!
          </p>
          
          {history.length > 0 && (
            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="link"
            >
              View Recent Approval History
            </Button>
          )}
        </div>

        {showHistory && <ApprovalHistory history={history} />}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-4 shadow">
        <div>
          <div className="text-sm text-muted-foreground">Filters</div>
          <div className="text-xs text-muted-foreground">
            Showing {filteredApprovals.length} of {approvals.length}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-56 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Search by category, project, employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "ALL" | "EXPENSE" | "INCOME")}
          >
            <option value="ALL">All Types</option>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
          {(search || typeFilter !== "ALL") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setTypeFilter("ALL");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 p-4">
          <div className="text-sm font-medium text-blue-900">
            {selectedIds.size} item(s) selected
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkApprove}
              disabled={pending}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? "Processing..." : "Approve Selected"}
            </Button>
            <Button
              onClick={() => setShowBulkReject(true)}
              disabled={pending}
              variant="destructive"
            >
              Reject Selected
            </Button>
            <Button
              onClick={() => setSelectedIds(new Set())}
              variant="ghost"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Approvals Table */}
      <div className="mb-4 space-y-3 md:hidden">
        {filteredApprovals.map((expense) => {
          const walletBalance = parseFloat(expense.walletBalance.toString());
          const walletHold = parseFloat(expense.walletHold.toString());
          const availableBalance = walletBalance - walletHold;
          const amount = parseFloat(expense.amount.toString());
          return (
            <div key={expense.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">{new Date(expense.date).toLocaleDateString()}</div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(expense.id)}
                    onChange={() => handleSelectOne(expense.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Select
                </label>
              </div>
              <div className="text-sm font-semibold">
                {expense.submittedBy.name || expense.submittedBy.email}
              </div>
              <div className="text-xs text-muted-foreground">{expense.submittedBy.email}</div>
              <div className="mt-2 text-sm">{expense.description}</div>
              <div className="mt-1 text-xs text-muted-foreground">Category: {expense.category}</div>
              {expense.project ? (
                <div className="mt-1 text-xs text-muted-foreground">Project: {expense.project}</div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{formatMoney(amount)}</span>
                <ApprovalLevelBadge level={expense.requiredApprovalLevel} />
              </div>
              {expense.type === "EXPENSE" ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  Wallet available: <span className="font-medium">{formatMoney(availableBalance)}</span>
                </div>
              ) : null}
              <div className="mt-3">
                {expense.type === "INCOME" ? (
                  <IncomeApprovalActions incomeId={expense.id} amount={amount} status={expense.status} />
                ) : (
                  <ApprovalActions
                    expenseId={expense.id}
                    amount={amount}
                    employeeName={expense.submittedBy.name || expense.submittedBy.email}
                    currentBalance={availableBalance}
                    afterBalance={availableBalance}
                    categoryLimit={expense.categoryLimit ?? undefined}
                    categoryStrict={expense.categoryStrict ?? undefined}
                    status={expense.status}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-6 hidden overflow-x-auto rounded-lg bg-card shadow md:block">
        <table className="min-w-[1460px] divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={
                    filteredApprovals.length > 0 &&
                    filteredApprovals.every((item) => selectedIds.has(item.id))
                  }
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-border"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Wallet Impact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Level
              </th>
              <th className="whitespace-nowrap bg-muted px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filteredApprovals.map((expense) => {
              const walletBalance = parseFloat(expense.walletBalance.toString());
              const walletHold = parseFloat(expense.walletHold.toString());
              const availableBalance = walletBalance - walletHold;
              const amount = parseFloat(expense.amount.toString());
              const afterBalance = availableBalance; // full approval keeps available unchanged
              const isInsufficient = availableBalance < 0;
              const isLow = availableBalance < 10000 && availableBalance >= 0;

              return (
                <tr
                  key={expense.id}
                  className={`hover:bg-accent ${
                    selectedIds.has(expense.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(expense.id)}
                      onChange={() => handleSelectOne(expense.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    <div className="font-medium">
                      {expense.submittedBy.name || expense.submittedBy.email}
                    </div>
                    <div className="text-muted-foreground">{expense.submittedBy.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        expense.type === "INCOME"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {expense.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                    {expense.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    <div className="max-w-xs truncate" title={expense.description}>
                      {expense.description}
                    </div>
                    {expense.categoryRequest && (
                      <div className="mt-1 text-xs text-amber-700">
                        Category request: {expense.categoryRequest}
                      </div>
                    )}
                    {expense.remarks && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Remarks: {expense.remarks}
                      </div>
                    )}
                    {expense.project && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Project: {expense.project}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-foreground">
                    {formatMoney(amount)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {expense.type === "INCOME" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-muted-foreground">
                          Available: <span className="font-medium">{formatMoney(availableBalance)}</span>
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
                          After (full): {formatMoney(afterBalance)}
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
                          <div className="text-xs text-yellow-600">Low balance</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <ApprovalLevelBadge level={expense.requiredApprovalLevel} />
                  </td>
                  <td className="whitespace-nowrap bg-card px-6 py-4 text-sm">
                    {expense.type === "INCOME" ? (
                      <IncomeApprovalActions
                        incomeId={expense.id}
                        amount={amount}
                        status={expense.status}
                      />
                    ) : (
                      <ApprovalActions
                        expenseId={expense.id}
                        amount={amount}
                        employeeName={expense.submittedBy.name || expense.submittedBy.email}
                        currentBalance={availableBalance}
                        afterBalance={afterBalance}
                        categoryLimit={expense.categoryLimit ?? undefined}
                        categoryStrict={expense.categoryStrict ?? undefined}
                        status={expense.status}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredApprovals.length === 0 && approvals.length > 0 && (
        <div className="rounded-lg bg-card p-6 text-center text-muted-foreground shadow">
          No approvals match the current filters.
        </div>
      )}

      {/* Approval History Toggle */}
      {history.length > 0 && (
        <div className="mb-4">
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant="link"
          >
            {showHistory ? "Hide" : "Show"} Recent Approval History ({history.length})
          </Button>
        </div>
      )}

      {showHistory && <ApprovalHistory history={history} />}

      {/* Bulk Reject Modal */}
      {showBulkApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Approve {selectedIds.size} Item(s)
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This will run full approval posting for selected records.
            </p>
            <div className="mb-5 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div>Expense items: {approvals.filter((a) => selectedIds.has(a.id) && a.type === "EXPENSE").length}</div>
              <div>Income items: {approvals.filter((a) => selectedIds.has(a.id) && a.type === "INCOME").length}</div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowBulkApprove(false)}
                disabled={pending}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmBulkApprove}
                disabled={pending}
              >
                {pending ? "Approving..." : "Confirm Approve"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBulkReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Reject {selectedIds.size} Expense(s)
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Please provide a reason for rejecting these expenses.
            </p>
            <textarea
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="mb-4 w-full rounded border border-border bg-background p-2 text-sm"
              rows={4}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setShowBulkReject(false);
                  setBulkRejectReason("");
                }}
                disabled={pending}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkReject}
                disabled={pending || !bulkRejectReason.trim()}
                variant="destructive"
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? "Rejecting..." : "Confirm Reject All"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IncomeApprovalActions({
  incomeId,
  amount,
  status,
}: {
  incomeId: string;
  amount: number;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function handleApprove() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incomeId,
            action: "APPROVE",
            approvedAmount: amount,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to approve income");
        }

        toast.success("Income approved successfully!");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      }
    });
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incomeId,
            action: "REJECT",
            reason: rejectReason,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to reject income");
        }

        toast.success("Income rejected successfully!");
        setShowRejectModal(false);
        setRejectReason("");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      }
    });
  }

  if (!status.startsWith("PENDING")) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={handleApprove} disabled={pending} size="sm">
          {pending ? "Processing..." : "Approve"}
        </Button>
        <Button
          onClick={() => setShowRejectModal(true)}
          disabled={pending}
          variant="destructive"
          size="sm"
        >
          Reject
        </Button>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Reject Income</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Provide a reason for rejection.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="mb-4 w-full rounded border border-border bg-background p-2 text-sm"
              rows={4}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={pending || !rejectReason.trim()}
              >
                {pending ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ApprovalLevelBadge({ level }: { level: string }) {
  const badges: Record<string, { color: string; text: string }> = {
    L1: { color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300", text: "L1" },
    L2: { color: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300", text: "L2" },
    L3: { color: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300", text: "L3" },
    AUTO: { color: "bg-muted text-foreground", text: "Auto" },
    MANAGER: { color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300", text: "Manager" },
    FINANCE_MANAGER: { color: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300", text: "Finance Mgr" },
    CEO: { color: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300", text: "CEO" },
  };

  const badge = badges[level] || badges.L1;

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badge.color}`}>
      {badge.text}
    </span>
  );
}

function ApprovalHistory({ history }: { history: HistoryItem[] }) {
  return (
    <div className="mt-6 rounded-lg bg-card p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Recent Approval History</h3>
      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border-l-4 border-border bg-muted p-3"
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
                <span
                  className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                    item.type === "INCOME" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.type}
                </span>
                <span className="text-sm font-medium text-foreground">{item.category}</span>
                <span className="text-sm text-muted-foreground">
                  {formatMoney(parseFloat(item.amount.toString()))}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
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
