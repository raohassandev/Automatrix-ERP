'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface ApprovalActionsProps {
  expenseId: string;
  amount: number;
  employeeName: string;
  currentBalance: number;
  afterBalance: number;
}

export default function ApprovalActions({
  expenseId,
  amount,
  employeeName,
  currentBalance,
  afterBalance,
}: ApprovalActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isInsufficient = afterBalance < 0;

  async function handleApprove() {
    const warningMessage = isInsufficient
      ? `⚠️ WARNING: Insufficient wallet balance!\n\nCurrent Balance: PKR  ${currentBalance.toLocaleString()}\nExpense Amount: PKR  ${amount.toLocaleString()}\nShortfall: PKR  ${Math.abs(afterBalance).toLocaleString()}\n\nThis approval will be BLOCKED by the system.\n\nDo you want to proceed anyway?`
      : `Approve expense of PKR  ${amount.toLocaleString()} for ${employeeName}?\n\nCurrent Balance: PKR  ${currentBalance.toLocaleString()}\nAfter Approval: PKR  ${afterBalance.toLocaleString()}\n\nThis will deduct the amount from their wallet.`;

    const confirmed = window.confirm(warningMessage);

    if (!confirmed) return;

    setError(null);

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

      alert(
        '✅ Expense approved successfully!\n\nWallet deducted: PKR  ' +
          amount.toLocaleString(),
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      alert('❌ ' + message);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setError(null);

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

      alert('✅ Expense rejected successfully!');
      setShowRejectModal(false);
      setRejectReason('');
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      alert('❌ ' + message);
    }
  }

  return (
    <>
      <div className='flex gap-2'>
        <button
          onClick={handleApprove}
          disabled={pending}
          className={`rounded px-3 py-1 text-white disabled:opacity-50 ${
            isInsufficient
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
          title={
            isInsufficient
              ? 'Warning: Insufficient wallet balance'
              : 'Approve expense'
          }
        >
          {pending
            ? 'Processing...'
            : isInsufficient
              ? '⚠️ Approve'
              : 'Approve'}
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={pending}
          className='rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50'
        >
          Reject
        </button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-gray-900'>
              Reject Expense
            </h3>
            <p className='mb-4 text-sm text-gray-600'>
              Please provide a reason for rejecting this expense of PKR{' '}
              {amount.toLocaleString()} from {employeeName}.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder='Enter rejection reason...'
              className='mb-4 w-full rounded border border-gray-300 p-2 text-sm'
              rows={4}
              disabled={pending}
            />
            {error && (
              <div className='mb-4 rounded bg-red-50 p-2 text-sm text-red-800'>
                {error}
              </div>
            )}
            <div className='flex justify-end gap-2'>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setError(null);
                }}
                disabled={pending}
                className='rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={pending || !rejectReason.trim()}
                className='rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50'
              >
                {pending ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
