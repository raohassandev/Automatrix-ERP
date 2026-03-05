# Staging Module + Cross-Module Audit (Discrepancies Only)

Date: 2026-03-05  
Target: `https://erp-staging.automatrix.pk`  
Scope: Implemented modules (Finance/Accounting, Inventory, Projects, Procurement, Expense, HRMS/Payroll, Approvals, RBAC, Mobile UI/UX)

## Execution Summary

- Playwright suites executed: module, role, mobile, and cross-module integration specs in `playwright/tests`.
- Initial full pass executed all suites; then blocked/skipped scenarios were re-run directly.
- Final validated baseline after false-negative cleanup: only **2 true discrepancies** remain open.

## Open Discrepancies

### 1) [CRITICAL] Company Account Detail action menu does not expose `Record Vendor Payment` for finance path

- Module: Treasury/Finance + Procurement integration
- Area: Company Account Workhub actions
- Test evidence:
  - `playwright/tests/vendor-item-workhub-actions.spec.ts`
  - Failing case: `Company Account Detail: finance-only access + API-negative + mobile smoke`
- Repro:
  1. Login as finance user (`finance1@automatrix.pk`).
  2. Open a company account detail page.
  3. Click `Actions`.
  4. Expected `Record Vendor Payment` menu action is not visible.
- Impact:
  - Blocks direct treasury-to-vendor-payment operational flow from account detail.
  - Creates role UX inconsistency (finance should have this action).
- Suspected layer:
  - Workhub action rendering/runtime dropdown visibility path in company account detail UI.

### 2) [MAJOR] Horizontal overflow on key pages

- Module: UX/Layout (global shell)
- Area: Page layout responsiveness (desktop shell width sanity)
- Test evidence:
  - `playwright/tests/staging-deep-audit.spec.ts`
  - Failing case: `Finance UX smoke across completed modules (layout + runtime errors)`
  - Routes with overflow:
    - `/settings`
    - `/inventory`
- Repro:
  1. Login as finance user.
  2. Open `/settings` and `/inventory`.
  3. Page shell width exceeds viewport (`documentElement.scrollWidth > innerWidth + 8`).
- Impact:
  - Degraded UX and visual instability, especially on constrained laptop widths and zoomed views.
  - Increases risk of hidden controls and poor mobile/tablet transition behavior.

## Notes on Closed False Negatives (Test Assertions Updated)

The following were test assertion mismatches (not product access failures):
- Access denial copy changed to `Access Denied / You do not have permission to open this page.`
- Updated assertions to accept `access denied` text in:
  - `playwright/tests/item-detail-and-me-portal.spec.ts`
  - `playwright/tests/staging-deep-audit.spec.ts`

## Current Gate Status

- Critical open: **1**
- Major open: **1**
- Medium open: 0
- Low open: 0

Production readiness for implemented modules is **No-Go** until these two discrepancies are fixed and re-validated.
