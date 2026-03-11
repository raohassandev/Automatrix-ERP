# Post-Fix Discrepancy Audit (Implemented Modules)
Date: 2026-03-11
Scope: Finance/Accounting, Inventory, Projects, Expense, Wallet/Advances, Payroll, Approvals, Settings/RBAC

## Open Discrepancies Only

1. Major — Project financial cross-surface parity still needs full staging data verification
- Areas: project list, project detail, project financial dashboard, reports exports.
- Risk: totals can drift if real data uses mixed project aliases or legacy rows.
- Required closure: run staging reconciliation checks on top projects and lock mismatch report to zero.

2. Major — UX consistency sweep is incomplete on overview pages
- Areas: dashboard, my portal, expenses, financial dashboard card/table spacing and mobile overflow edge cases.
- Risk: readability and action discoverability degrade for non-technical users.
- Required closure: finish token standardization + mobile overflow normalization with screenshot evidence.

3. Major — Loading states are not uniformly applied
- Areas: long-running pages/forms (especially data-heavy list pages and reconciliation views).
- Risk: users interpret slow state as broken state and retry actions.
- Required closure: skeleton/loading indicators on all long-query pages and mutation submits.

4. Medium — Remaining destructive patterns review not fully closed
- Areas: implemented-module delete/void/reopen API surface.
- Risk: accidental historical data loss in edge routes.
- Required closure: complete endpoint inventory and convert all financial/posted delete paths to reversal or blocked policy.

5. Medium — Automated deep audit local run currently blocked by stale test credential assumptions
- Areas: Playwright bootstrap user (`finance1@automatrix.pk`) in local run profile.
- Risk: false-negative CI/local audit confidence.
- Required closure: align test credentials/env secrets or migrate specs to stable seeded account alias.

## Closed in this pass
- Inline help flows: Expenses/Incentives/Project Detail.
- Project Detail: removed duplicate KPI strip and added searchable project switcher.
- Project Financial dashboard: dark/light token consistency improvements for summary and per-project cards.

