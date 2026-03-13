# Staging Discrepancy Closure (Implemented Modules)

Date: 2026-03-13  
Environment: `https://erp-staging.automatrix.pk`  
Scope: implemented modules only (Finance/Accounting, Inventory, Projects, Expense, Employee/HRMS/Payroll, Approvals, Settings/RBAC)

## Evidence Runs

1. `pnpm verify:staging:effective-permissions` -> pass (`noOverrideMismatchCount: 0`)
2. `pnpm verify:projects:financial-consistency` -> pass (`driftCount: 0`)
3. `pnpm qa:staging:batch` -> initial run had transient `Internal Server Error` failures while deployment was active.
4. Post-deploy rerun (targeted failed/flaky set):
   - `dashboard-approvals-mobile-smoke.spec.ts` -> pass
   - `inventory-rbac-actions.spec.ts` -> pass with 1 flaky retry
   - `payroll-deep-audit.spec.ts` -> pass
   - `mobile-role-navigation.spec.ts` -> pass
   - `project-workhub-actions.spec.ts` -> pass

## Open Discrepancies Only

1. `Minor / Non-blocking` - Playwright flake on inventory detail navigation under staging latency.
   - Test: `playwright/tests/inventory-rbac-actions.spec.ts` (`Item detail actions follow effective permissions`)
   - Observed behavior: first attempt timeout on `page.goto('/inventory/items/:id')`; retry passed.
   - Impact: no functional regression reproduced after rerun; stability issue in test/runtime timing only.
   - Follow-up: tighten navigation readiness in test helper and/or add route-level lightweight loading signal for inventory item detail.

## Closure Decision (Implemented Scope)

- Critical open discrepancies: `0`
- Major open discrepancies: `0`
- Minor open discrepancies: `1` (flaky timeout, non-deterministic, rerun passes)

Implemented module scope is audit-closed for staging operation with the above minor residual tracked.
