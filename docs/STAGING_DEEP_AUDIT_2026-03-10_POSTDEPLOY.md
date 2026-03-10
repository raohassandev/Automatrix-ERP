# Staging Deep Audit (Post-Deploy) — 2026-03-10

- Environment: `https://erp-staging.automatrix.pk`
- Deployed commit: `cd05eb4`
- Scope: implemented modules only (finance/accounting, inventory/store, procurement, projects, expense, approvals, employee/hrms/payroll, settings/rbac, overview UX).

## 1) Automated Audit Evidence

- Command: `pnpm test:staging:critical:fast`
- Result: `41 passed / 0 failed`
- Included suites:
  - dashboard + approvals mobile smoke
  - mobile role navigation
  - inventory RBAC actions
  - project detail RBAC
  - project workhub actions
  - vendor/item workhub actions
  - payroll deep audit
  - payroll settlement smoke (new)
  - procurement/inventory controls
  - staging deep audit

### 1.1 Effective permission parity + rerun evidence

- Command: `pnpm verify:staging:effective-permissions`
- Initial result: mismatches found due stale built-in DB templates after new task permission baseline.
- Corrective action (non-destructive): `POST /api/access-control/roles/sync`
  - Response: `changedCount: 14`
- Re-run result: `noOverrideMismatchCount: 0`
- Then re-ran full critical suite:
  - Command: `pnpm test:staging:critical:fast`
  - Result: `41 passed / 0 failed`
- Note: one intermediate run failed due staging login timeouts (`/login` timeout/502-window behavior). Health checks (`/api/health`) returned consistent `200` before final rerun.

## 2) New Payroll Flow Verification (Requested Items)

### 2.1 Auto-create monthly draft (fixed date automation)

- Endpoint available: `POST /api/payroll/runs/auto-draft`
- Public unauthenticated probe returns `401` (expected).
- Authenticated smoke (Finance session) returns success/skipped without server errors.
- Runbook added: `docs/PAYROLL_AUTOMATION_RUNBOOK_2026-03-10.md`

### 2.2 Per-employee mark-paid workflow

- Endpoint available: `POST /api/payroll/runs/[id]/entries/[entryId]/mark-paid`
- Non-destructive probe using invalid entry id on valid run returns `404` (expected route behavior).
- UI controls present on payroll page:
  - `Settle Entries` action
  - employee-wise status and mark-paid action within settlement dialog

### 2.3 Loading-state coverage

- Added loading skeleton: `src/app/payroll/loading.tsx`
- Added action-level loading indicators:
  - payroll approve button
  - auto-create draft button
  - per-entry mark-paid action

## 3) Contextual Help Coverage

- Route-aware help launcher is globally available in layout (desktop + mobile).
- `/help` now contains feature procedure library with controls/effects and quick links.
- New guidance is tied to related pages via `How this works`.

## 4) Discrepancies (Post-Deploy)

- Critical: `0`
- Major: `0`
- Minor: `0` from automated suite and endpoint smoke

## 5) Residual Risk / Manual UAT Needed

- Per-entry payroll posting mutation (real payout) was intentionally not executed in audit to avoid altering live staging business data.
- Recommended controlled UAT:
  1. create/choose a dedicated test payroll run in staging,
  2. approve run,
  3. mark one employee paid,
  4. verify wallet/expense/component/settlement cross-module effects,
  5. clean test artifact rows.
