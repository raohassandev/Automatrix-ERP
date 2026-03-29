# Employee Finance Workspace TODO

Date: 2026-03-29  
Owner: Codex implementation pass  
Scope: Separate `Profile` from employee-level finance operations and provide an accountant/owner-ready working surface.

## 1) Product Separation

- [x] Keep `Employee Profile` as identity/HR-focused record.
- [x] Add dedicated `Employee Finance Workspace` page for interval-based operations.
- [x] Add quick navigation from Employees list and Employee profile into Finance Workspace.

## 2) P0 Workspace Capabilities

- [x] Employee selector by name/email (no memorized ID requirement).
- [x] Interval filters (`from`, `to`) and free-text search.
- [x] Module/event filter (Wallet, Expense, Advance, Payroll, Incentive, Commission).
- [x] Consolidated KPI cards:
  - opening/closing balance (range-bounded)
  - issued vs consumed
  - expense booked/approved/payable/paid
  - advances issued/outstanding
  - settled credits (payroll/incentive/commission)
- [x] Unified timeline table with source drill links.

## 3) Discoverability and Flow

- [x] Sidebar entry added under People: `Employee Finance`.
- [x] Employees table action added: `Finance`.
- [x] Employee detail action added: `Open Finance Workspace`.

## 4) Validation and Output

- [x] Run `pnpm typecheck`.
- [x] Run focused tests and/or build gate.
- [x] Capture result snapshot in `SUPER_MASTER_PLAN.md` as next closure batch.

## 5) Next Deepening (Planned)

- [ ] Add export endpoint for exact workspace filters.
- [ ] Add exception engine cards (unsettled pocket payable, overdue recoveries, negative-availability attempts).
- [ ] Add reconciliation lock checks and finance action buttons from workspace.
