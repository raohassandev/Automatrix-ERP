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
  status: string;
}

export default function ApprovalActions({
  expenseId,
  amount,
  employeeName,
  currentBalance,
  afterBalance,
  status,
}: ApprovalActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isInsufficient = afterBalance < 0;

  async function handleApprove() {
    const warningMessage = isInsufficient
      ? `⚠️ WARNING: Insufficient wallet balance!\n\nCurrent Balance: PKR  ${currentBalance.toLocaleString()}\nExpense Amount: PKR  ${amount.toLocaleString()}\nShortfall: PKR  ${Math.abs(afterBalance).toLocaleString()}\n\nThis approval will be BLOCKED by the system.\n\nDo you want to proceed anyway?`
      : `Approve expense of PKR  ${amount.toLocaleString()} for ${employeeName}?\n\nCurrent Balance: PKR  ${currentBalance.toLocaleString()}\nAfter Approval: PKR  ${afterBalance.toLocaleString()}\n\nThis will deduct the amount from their wallet.`;

    const confirmed = window.confirm(warningMessage);

    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expenseId,
            action: 'APPROVE',
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to approve expense');
        }

        toast.success(
          'Expense approved successfully!',
          {
            description: `Wallet deducted: PKR ${amount.toLocaleString()}`,
          }
        );
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

  if (status === 'PENDING') {
    return (
      <>
        <div className='flex gap-2'>
          <Button
            onClick={handleApprove}
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
