# Audit Execution Tracker (2026-03-11)

Purpose: execute `report.md` recommendations in controlled batches (no tiny deploys), track completion evidence, and close discrepancies on implemented modules.

## Rules of execution
- Batch size: 4-8 related fixes per deploy.
- Deploy gate: typecheck + focused tests + local smoke checklist.
- Data safety: no destructive cleanup on real business records.
- Accounting safety: posted/paid records are immutable; corrections via reversal/adjustment only.

## Workstream Status

### WS-0 Transaction Safety Spine (Critical)
- [x] Block payroll run delete when any entry is PAID (`BLOCK_DELETE_PAYROLL_RUN_PAID`).
- [x] Restrict invoice delete to DRAFT-only; block linked receipt/income deletion.
- [x] Remove hard-delete guidance from project delete responses; enforce close/archive + reversal messaging.
- [x] Disable destructive delete endpoint for project linked-record cleanup; allow only reversal/adjustment policy path.
- [x] Restrict incentive deletion to `PENDING` only (no delete after approval).
- [x] Block company-account deletion when any transactional references exist (deactivate-only policy).
- [~] Convert remaining destructive delete endpoints in implemented modules to reverse/void/close patterns.
  - 2026-03-11 progress: `inventory/[id] DELETE` now blocks deletion when stock exists or when any ledger/vendor-bill history exists.
  - 2026-03-11 progress: `employees/[id] DELETE` now enforces non-destructive behavior (auto-deactivate when linked records exist; delete only when orphan).
  - 2026-03-11 progress: `salary-advances/[id] DELETE` now allows deletion only in `PENDING` state.
  - 2026-03-11 progress: `commissions/[id] DELETE` now allows deletion only in `PENDING` state.
- Evidence:
  - `src/app/api/payroll/runs/[id]/route.ts`
  - `src/app/api/invoices/[id]/route.ts`
  - `src/app/api/projects/[id]/route.ts`
  - `src/app/api/projects/[id]/linked-records/route.ts`
  - `src/app/api/incentives/[id]/route.ts`
  - `src/app/api/company-accounts/[id]/route.ts`

### WS-1 RBAC + Navigation Consistency (Critical)
- [x] Verify sidebar/mobile menu visibility by role matrix (`mobile-role-navigation`, `vendor-item-workhub-actions`).
- [x] Verify effective permissions parity for active users (`verify:staging:effective-permissions`: 17 users, 0 mismatches).
- [x] Ensure dashboard workspace/action links hide forbidden actions (avoid click-to-forbidden pattern).
- [x] Validate `/api/me/effective-permissions` parity with server route checks (no-override mismatch count: 0).

### WS-2 Payroll + Incentive Correctness (Critical)
- [x] Reconcile payroll totals with approved + unsettled incentive entries (removed exclusion that hid entries by creation date cutoff).
- [x] Ensure base salary default is pulled from employee profile and log payroll base-salary overrides in audit trail.
- [x] Add employee-wise payable snapshot grid (payroll due + incentive due + counts + aging).
- [x] Make payout state auditable per employee and payroll run with settlement log trail on payroll page.

### WS-3 Wallet/Expense Source-of-Funds Integrity (Critical)
- [x] Enforce explicit expense funding source on every submission (no implicit fallback source).
- [x] Block invalid own-pocket usage when wallet advance exists (with audit event on block).
- [x] Fix My Portal reimbursement cards to use row-wise approved-vs-submitted amount resolution (avoid aggregate drift).
- [x] Ensure approved vs paid reimbursement logic reflects correctly in dashboard cards via row-wise expense-state resolver.

### WS-4 Project Financial Truthfulness (Major)
- [~] Align project KPIs/list/details/reports for: contract, received, pending, cost-to-date, profit/margin.
  - 2026-03-11 progress: added reconciliation utility scripts `pnpm ops:projects:financials:dry` and `pnpm ops:projects:financials:apply` to realign stored project snapshot fields with computed truth in controlled batches.
- [~] Validate income/expense/project allocation links for real staging projects.
  - 2026-03-11 progress: added automated verifier `pnpm verify:projects:financial-consistency` to detect per-project metric drift and unresolved project refs in income/expense records.
  - Latest run (local env sample): unresolved refs = `0`, drift candidates = `1` (`AE-MON-CI-90` pendingRecovery delta).
- [x] Add missing budget/contract card in project executive summary (theme-safe).

### WS-5 UX/UI and Theme Sweep (Major)
- [~] Fix contrast and card token consistency for dark/light themes.
- [~] Normalize table/action alignment and overflow on desktop + mobile.
- [~] Add loading states/skeletons for long-running forms/lists.

### WS-6 Help and Procedure Layer (Major)
- [x] Add contextual help button on payroll/incentives/expenses/projects pages.
- [x] Provide concise “how this flow works” guidance, role aware and action linked.

### WS-7 Master Plan and Audit Sync (Major)
- [x] Update `SUPER_MASTER_PLAN.md` snapshot with closed items and residuals.
- [x] Publish discrepancy-only post-fix deep audit report.

## Current Batch (B1)
Scope:
1. Delete-safety hardening for payroll, invoices, projects.
2. Tracker initialization.
3. Validation pass and cleanup of disposable local artifacts.

Exit criteria:
- No paid payroll delete path.
- No non-draft invoice delete.
- Project delete messaging aligned to close/archive policy.
- Validation commands green.
