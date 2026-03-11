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
- [ ] Convert remaining destructive delete endpoints in implemented modules to reverse/void/close patterns.
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
- [ ] Ensure approved vs paid reimbursement logic reflects correctly in dashboard + wallet ledger.

### WS-4 Project Financial Truthfulness (Major)
- [ ] Align project KPIs/list/details/reports for: contract, received, pending, cost-to-date, profit/margin.
- [ ] Validate income/expense/project allocation links for real staging projects.
- [ ] Add missing budget/contract card in project executive summary (theme-safe).

### WS-5 UX/UI and Theme Sweep (Major)
- [ ] Fix contrast and card token consistency for dark/light themes.
- [ ] Normalize table/action alignment and overflow on desktop + mobile.
- [ ] Add loading states/skeletons for long-running forms/lists.

### WS-6 Help and Procedure Layer (Major)
- [ ] Add contextual help button on payroll/incentives/expenses/projects pages.
- [ ] Provide concise “how this flow works” guidance, role aware and action linked.

### WS-7 Master Plan and Audit Sync (Major)
- [ ] Update `SUPER_MASTER_PLAN.md` snapshot with closed items and residuals.
- [ ] Publish discrepancy-only post-fix deep audit report.

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
