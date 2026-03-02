# Staging Deep Audit Report — 2026-03-02

## Environment
- Target: `https://erp-staging.automatrix.pk/`
- Date: `2026-03-02`
- Method: Playwright staging suite + authenticated API verification + controlled workflow transaction tests

## Pre-audit enablement (staging QA only)
- Existing local Playwright suites were tied to local E2E login mode and could not authenticate directly on staging.
- I verified staging credentials login UI is enabled.
- To execute role-based audits without touching business records, I set password hashes (`e2e`) on existing staging QA users (`finance1/engineer1/sales1/store1/technician1`) on VPS app DB.
- No deletion or reset of real transactional data was performed.

## Test execution
- Commands run:
  - Full suite: `pnpm exec playwright test --config=playwright.config.staging.ts`
  - Focused rerun (failed suites): `pnpm exec playwright test --config=playwright.config.staging.ts playwright/tests/item-detail-and-me-portal.spec.ts playwright/tests/rb4-expenses-nonstock.spec.ts playwright/tests/rb4-procurement-chain.spec.ts playwright/tests/staging-deep-audit.spec.ts`
- Full suite result:
  - `29 passed`, `5 failed`, `3 did not run`
  - After rerun + test-harness fixes:
    - `7 passed`, `3 failed`
- Final defect classification from failing cases:
  - Real product defect: `1` (layout overflow on `/expenses` and `/inventory`)
  - Test harness assumption drift: `2` (negative expense tests using role without submit permission)

## Additional API verification (authenticated)
- All sampled completed-module APIs returned `200`:
  - `/api/settings/organization`
  - `/api/expenses`
  - `/api/approvals`
  - `/api/approvals?type=stats`
  - `/api/audit`
  - `/api/payroll/runs`
  - `/api/accounting/journals`
  - accounting report APIs (`cash-position`, `trial-balance`, `profit-loss`, `balance-sheet`)

## Findings (ordered by severity)

### 1) Medium — Horizontal layout overflow in core operations pages
- Severity: `P2` (UX/layout quality issue; not data-loss)
- Pages:
  - `/expenses`
  - `/inventory`
- Evidence:
  - Playwright assertion failed:
    - `document.documentElement.scrollWidth > window.innerWidth + 8`
  - Failing run artifact:
    - `test-results/staging-deep-audit-Staging-bb4ff-ules-layout-runtime-errors-/trace.zip`
    - `test-results/staging-deep-audit-Staging-bb4ff-ules-layout-runtime-errors-/test-failed-1.png`
- Impact:
  - Desktop users can get side-scroll and clipped primary workflows.
  - Reduces operator clarity in high-frequency transaction screens.
- Suggested fix:
  - Re-check table/card wrappers for min-width behavior and non-wrapping content.
  - Add route-specific overflow guards in `Expenses` and `Inventory` page containers.

### 2) Low — Playwright negative tests outdated against current RBAC
- Severity: `P3` (test-harness quality gap; product behavior is correct)
- Affected specs:
  - `playwright/tests/rb4-expenses-nonstock.spec.ts`
  - `playwright/tests/rb4-procurement-chain.spec.ts` (negative expense case)
- Evidence:
  - Tests expected `400` stock-block response, but got `403` because `finance1` lacks `expenses.submit`.
- Product verification:
  - Direct API check using authorized submitter role (`engineer1`) returned expected `400` and message:
    - `"Stock purchases are not allowed in Expenses (Phase 1)..."`
- Suggested fix:
  - Keep negative policy checks, but execute them with a role that has `expenses.submit`.
  - Separate assertions:
    - `403` for unauthorized submitter
    - `400` policy block for authorized submitter with stock keys.

## Completed-module audit status summary

### Organization and Settings
- Status: **Pass (tested)**
- Notes:
  - Settings page and `/api/settings/organization` functional under authenticated access.
  - Organization defaults are actively consumed by expense policy flow.

### Master Data Management
- Status: **Pass (tested)**
- Notes:
  - Master Data page loads correctly.
  - Master data quality panel visible and populated.

### Expense Management
- Status: **Pass (tested with entry-effect workflow)**
- Workflow validated:
  - Engineer creates expense (with receipt)
  - Finance sees pending item in approvals
  - Finance approves
  - Finance marks paid
  - Journal entry appears in accounting journals
- Notes:
  - Server-side policy chain is functioning end-to-end.
  - Non-stock policy is enforced correctly for authorized submitters.

### Approvals Engine
- Status: **Pass (tested)**
- Notes:
  - Queue retrieval and approval actions succeeded.
  - Stats endpoint responds and is usable.

### Audit, Compliance, and Governance
- Status: **Pass (tested)**
- Notes:
  - `/audit` access correctly blocked for restricted role.
  - `/api/audit` responds with filtered/paginated payload.

### Reporting and BI
- Status: **Pass (tested)**
- Notes:
  - Reports home and controls report route load.
  - Core accounting report APIs responding correctly.

### Identity, RBAC, and Security
- Status: **Pass (tested)**
- Notes:
  - Credentials login on staging works for allowlisted active QA users.
  - RBAC spot checks passed (restricted role blocked from audit and employee detail).

## Payroll note (owner asked specifically)
- Payroll module pages and payroll runs API were included in this staging pass and responded correctly.
- No blocking inconsistencies were observed in this audit’s tested payroll scope.
- Not covered in this pass:
  - full month-end payroll reconciliation edge cases
  - exceptional deductions policy permutations
  - payslip output format/legal checklist review

## Artifacts
- Playwright config used:
  - `playwright.config.staging.ts`
- Test suites used:
  - `playwright/tests/staging-deep-audit.spec.ts`
  - Existing suites under `playwright/tests/*.spec.ts` (full run)
- Failure artifacts:
  - `test-results/staging-deep-audit-Staging-bb4ff-ules-layout-runtime-errors-/`
  - `test-results/rb4-expenses-nonstock-RB4--6ca07-s-rejects-inventory-payload/`
  - `test-results/rb4-procurement-chain-RB4--08840-ected-Phase-1-single-spine-/`
  - `playwright-report-staging/`

## Addendum — Owner-Reported Project Audit (2026-03-02, rerun)

### Scope
- Target project: `AE-PV-IS-463` (`China Engineering Company`)
- Target environment: `https://erp-staging.automatrix.pk/`
- Owner-reported issues:
  - Pending amount missing on project list/detail
  - Inventory usage not visible on project detail
  - Project delete returns `500`

### Data check for `AE-PV-IS-463`
- Contract budget: `380,000`
- Received amount: `275,000`
- Prior issue state:
  - Legacy pending logic used invoice-only baseline and could show `0` when invoicing lagged.
  - No inventory ledger rows existed for the project even though approved material expenses existed.

### Root causes and fixes

#### 1) Pending amount not shown correctly
- Root cause:
  - Pending recovery depended only on invoiced baseline in practical display paths.
- Fix implemented:
  - Commercial pending now uses `max(contractValue, invoicedAmount) - receivedAmount`.
  - Added a separate `invoice-only pending` metric to preserve accounting transparency.
- Expected result for this project:
  - Pending recovery: `105,000` (`380,000 - 275,000`)

#### 2) Inventory usage not shown on project detail
- Root cause:
  - Project had approved material/stock expenses but no linked inventory-ledger records.
- Fix implemented:
  - Project detail inventory tab now falls back to approved material expenses when ledger links are absent.
  - UI shows explicit note indicating expense fallback mode.

#### 3) Delete endpoint returning `500`
- Root cause:
  - FK-linked records (expenses, assignments, etc.) triggered delete constraint errors.
- Fix implemented:
  - `DELETE /api/projects/:id` now pre-checks dependencies and returns meaningful status:
    - `409` when linked records block deletion
    - `200` when deletion is valid
    - Never raw `500` for this expected business case

### Verification run (post-fix)
- Commands:
  - `pnpm exec playwright test --config=playwright.config.staging.ts playwright/tests/staging-deep-audit.spec.ts playwright/tests/project-ae-pv-regression.spec.ts`
  - `pnpm exec playwright test --config=playwright.config.staging.ts playwright/tests/project-financial-overview.spec.ts`
- Results:
  - `staging-deep-audit`: `3 passed`
  - `project-ae-pv-regression`: `2 passed`
  - `project-financial-overview`: `2 passed`
- Total rerun status: **7 passed, 0 failed**

### Finding status update
- Previously reported overflow issue on `/expenses` and `/inventory`: **Closed** (verified by current deep-audit pass).
- `AE-PV-IS-463` pending + inventory visibility: **Closed** (verified in regression spec).
- Project delete `500` path: **Closed** (verified; now returns controlled business statuses).
- Previously reported RB4 test-harness role drift: **Closed** (specs updated to assert both `403` unauthorized and `400` policy block).

## Final closure update (2026-03-02, final rerun)

### Additional fixes applied
- `playwright/tests/rb4-expenses-nonstock.spec.ts`
  - Added dual-role assertions:
    - unauthorized submitter (`finance1`) must get `403`
    - authorized submitter (`engineer1`) must get `400` policy rejection for stock keys
- `playwright/tests/rb4-procurement-chain.spec.ts`
  - Updated negative expense stock-in test with the same dual-role behavior checks

### Final verification
- `pnpm exec playwright test --config=playwright.config.staging.ts playwright/tests/rb4-expenses-nonstock.spec.ts playwright/tests/rb4-procurement-chain.spec.ts`
  - Result: `4 passed`
- `pnpm exec playwright test --config=playwright.config.staging.ts playwright/tests/staging-deep-audit.spec.ts playwright/tests/project-ae-pv-regression.spec.ts playwright/tests/project-financial-overview.spec.ts`
  - Result: `7 passed`

### Overall audit closure status
- Open findings from this report: **0**
- Reported defects fixed and revalidated on staging: **Yes**

## Full-regression rerun update (2026-03-02, latest)

### Scope
- Full staging suite run against `https://erp-staging.automatrix.pk/`
- Command:
  - `pnpm exec playwright test --config=playwright.config.staging.ts`

### Result
- **44 passed, 0 failed**
- Runtime: ~`8.0m`

### What was verified in this rerun
- Role-based access and API negatives across projects, vendors, inventory, procurement, and finance views
- Mobile layout and action usability on owner-critical pages (iPhone profile)
- Project overview/detail finance summaries, pending recovery behavior, and no-overflow checks
- Procurement/Inventory controls:
  - GRN blocked for non-receivable PO states
  - Duplicate vendor bill guard
  - Warehouse-level over-transfer guard
- Cross-module accounting effect chains:
  - Expense -> Approval -> Paid -> Journal
  - PO -> GRN -> Vendor Bill -> Vendor Payment posting

### Test-maintenance updates made during this rerun
- `playwright/tests/rb4-procurement-chain.spec.ts`
  - Aligned happy-path with enforced PO lifecycle (`DRAFT -> SUBMIT -> APPROVE`) before GRN creation.
- `playwright/tests/vendor-item-workhub-actions.spec.ts`
  - Project finance dashboard KPI assertion updated to match current UI label (`Current Profit`).

### Remaining gaps (coverage, not active defects)
- Payroll deep edges are still not fully automated:
  - month-end reconciliation permutations
  - exceptional deduction matrix permutations
  - payslip legal/format compliance checklist
- Visual quality is layout/runtime-smoke tested, but not pixel-baseline tested against a formal design system checklist.
