# Post-Fix Discrepancy Audit (Implemented Modules)
Date: 2026-03-12
Scope: Finance/Accounting, Inventory, Projects, Expense, Wallet/Advances, Payroll, Approvals, Settings/RBAC

## Evidence Snapshot
- `pnpm qa:staging:batch` result: `41/41` pass.
- `pnpm verify:staging:effective-permissions`: `17 users`, `0 mismatch`.
- `pnpm verify:projects:financial-consistency`: `drift 0`, `unresolved refs 0`.
- Drift reconciliation executed once on legacy row: `pnpm ops:projects:financials:apply` (`AE-MON-CI-90` pending recovery baseline corrected).

## Open Discrepancies Only

1. Critical — Payroll/Advance/Variable-Pay lifecycle still not fully ERP-grade
- Areas: salary advance recovery model, payroll disbursement model, incentive/commission single-channel settlement.
- Risk: deduction/recovery/payment truth can drift in real operations.
- Required closure: redesign lifecycle per posted-payable/payment channel with partial recovery tracking.

2. High — Posted correction workflows are still incomplete
- Areas: posted procurement documents (`GRN`, `Vendor Bill`, `Vendor Payment`) and paid payroll correction path.
- Risk: users can be blocked from correcting posted mistakes safely.
- Required closure: implement reversal/adjustment flows and remove placeholder “use reversal later” gaps.

3. Medium — Full destructive-endpoint closure is still partially open
- Areas: remaining implemented-module `DELETE` surfaces that are operationally safe but still hard-delete in pending/non-posted states.
- Risk: accidental historical cleanup outside intended reversal/void lifecycle.
- Required closure: complete endpoint-by-endpoint conversion to deactivate/void/reopen patterns where business-critical history can exist.

4. Medium — Visual design consistency still needs one focused owner/portal polish pass
- Areas: dashboard/portal card typography spacing and cross-theme emphasis hierarchy.
- Risk: readability/comprehension debt for non-technical users.
- Required closure: single UI token pass with screenshot signoff on owner + employee portal pages.

## Closed in this pass
- Project financial drift reduced to zero and enforced in QA gate.
- Payroll settlement smoke test stabilized (strict heading selector + deterministic assertions).
- Staging RBAC/workhub suites hardened for real latency (auth fallback, describe-level timeout controls, lower-parallel fast suite worker model).
