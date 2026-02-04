'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalActionsProps {
  expenseId: string;
  amount: number;
  employeeName: string;
  currentBalance: number;
  afterBalance: number;
  categoryLimit?: number;
  categoryStrict?: boolean;
  status: string;
}

export default function ApprovalActions({
  expenseId,
  amount,
  employeeName,
  currentBalance,
  afterBalance,
  categoryLimit,
  categoryStrict,
  status,
}: ApprovalActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState(String(amount));

  const isInsufficient = afterBalance < 0;

  async function handleApprove() {
    const parsedApproved = Number(approvedAmount);
    if (!approvedAmount || Number.isNaN(parsedApproved) || parsedApproved <= 0) {
      toast.error('Please enter a valid approved amount');
      return;
    }
    if (parsedApproved > amount) {
      toast.error('Approved amount cannot exceed submitted amount');
      return;
    }
    if (categoryStrict && categoryLimit && parsedApproved > categoryLimit) {
      toast.error(`Approved amount exceeds category limit (${categoryLimit})`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expenseId,
            action: parsedApproved < amount ? 'PARTIAL_APPROVE' : 'APPROVE',
            approvedAmount: parsedApproved,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to approve expense');
        }

        toast.success(
          'Expense approved successfully!',
          {
            description: `Approved: PKR ${parsedApproved.toLocaleString()}`,
          }
        );
        setShowApproveModal(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
      }
    });
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expenseId,
            action: 'REJECT',
            reason: rejectReason,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to reject expense');
        }

        toast.success('Expense rejected successfully!');
        setShowRejectModal(false);
        setRejectReason('');
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
      }
    });
  }

  async function handleMarkAsPaid() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/expenses/${expenseId}/mark-as-paid`, {
          method: 'PUT',
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to mark as paid');
        }

        toast.success('Expense marked as paid!');
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
      }
    });
  }

  if (status.startsWith('PENDING')) {
    return (
      <>
        <div className='flex gap-2'>
          <Button
            onClick={() => setShowApproveModal(true)}
            disabled={pending}
            variant={isInsufficient ? 'destructive' : 'default'}
            size="sm"
            title={
              isInsufficient
                ? 'Warning: Insufficient wallet balance'
                : 'Approve expense'
            }
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isInsufficient ? (
              '⚠️'
            ) : null}
            {pending ? 'Processing...' : 'Approve'}
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

        {/* Reject Modal */}
        {showRejectModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h3 className="mb-3 text-lg font-semibold text-foreground">Reject Expense</h3>
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
                    setRejectReason('');
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

        {showApproveModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h3 className="mb-3 text-lg font-semibold text-foreground">Approve Expense</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Submitted by {employeeName}. You can approve full or partial amount.
              </p>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Submitted: PKR {amount.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Available balance: PKR {currentBalance.toLocaleString()}
                </div>
                {categoryLimit ? (
                  <div className="text-sm text-muted-foreground">
                    Category limit: PKR {categoryLimit.toLocaleString()}
                    {categoryStrict ? " (strict)" : ""}
                  </div>
                ) : null}
                <input
                  type="number"
                  className="w-full rounded border border-border bg-background p-2 text-sm"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  min={0}
                  max={amount}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowApproveModal(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={pending}
                >
                  {pending ? "Approving..." : "Approve"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (status === 'APPROVED') {
    return (
      <Button onClick={handleMarkAsPaid} disabled={pending} size="sm">
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Mark as Paid
      </Button>
    );
  }

  return <span className="text-sm text-gray-500">{status}</span>;
}
