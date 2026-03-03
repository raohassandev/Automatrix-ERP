# RBAC Permission Surface Map (Implemented Modules)

Date: 2026-03-03
Scope: Implemented modules only (Finance/Accounting, Inventory, Projects, Expense, Employee/HRMS/Payroll, Approvals, Settings/RBAC)

## Navigation Surfaces

- Desktop sidebar: `src/components/Sidebar.tsx` via `navGroups` (`src/lib/navigation.ts`) + `useEffectivePermissions`.
- Mobile menu: `src/components/MobileMenu.tsx` via `navGroups` + `useEffectivePermissions`.
- Command palette: `src/components/CommandPalette.tsx` filtered by permission keys.
- Floating action button: `src/components/FloatingActionButton.tsx` (hidden when no visible actions).
- Action menu: `src/components/ActionMenu.tsx` (only rendered for visible actions).

## Route/API Parity Controls (Critical)

- Effective permission source: `/api/me/effective-permissions`.
- Route middleware fallback: `/forbidden` (no redirect-loop to guarded routes).
- Vendor Payments (Phase 1 finance/AP):
  - UI nav key: `company_accounts.manage`
  - Page/API key: `company_accounts.manage`
  - Parity status: aligned in this batch.

## Baseline Role Policy Locks

- Owner/CEO/Admin/CFO: CEO metrics allowed.
- Finance Manager:
  - Accounting + finance approvals allowed.
  - `dashboard.view_all_metrics` removed from default baseline.
  - Explicit temporary access still possible via user ALLOW override.

## User Override Model

- Role template default + user ALLOW/DENY overrides.
- Effective permissions must be read from `/api/me/effective-permissions` before UI rendering decisions.

## Known Remaining Risks

- Some long-tail pages still rely on permissive fallbacks in legacy blocks and require one more parity sweep.
- Staging role data drift can temporarily differ from source-role defaults until role-template save/sync is done.
