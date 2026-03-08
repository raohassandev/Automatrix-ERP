# Staging Readiness Audit (Discrepancy-Only)

Date: 2026-03-08  
Environment: `https://erp-staging.automatrix.pk`

## What was executed

1. Full staging deep gate:
   - `pnpm qa:staging:postgreen`
   - Result: pass (`40/40` core, mobile expense smoke pass, vendor/item/project zero-retry pass)
2. Test artifact cleanup:
   - `MODE=execute ./scripts/cleanup-staging-test-artifacts.sh`
   - Result: all `E2E/SMOKE/Playwright` rows removed in core transactional entities
3. Cross-module integrity checks (read-only SQL on staging DB):
   - Expense/income/vendor bill/vendor payment posting-batch linkage
   - AP overpayment check
   - Incentive/payroll source linkage
   - Wallet balance vs ledger latest-balance parity
   - Inventory negative/duplicate checks

## Open discrepancies

### 1) Legacy project snapshot mismatch (data migration exception)
- Severity: Medium
- Project: `PV-89` (`Form House H9 ISB`)
- Observation:
  - Project snapshot `receivedAmount = 963,082`
  - Linked approved income rows by `Income.project = Project.projectId` = `0`
- Impact:
  - Project-level received-vs-income reconciliation query shows one mismatch row.
- Current decision:
  - Not auto-corrected to avoid changing real business data without owner decision.
- Recommended resolution options:
  1. Create explicit legacy opening income entries and post them to proper account.
  2. Or formally classify this project as pre-spine migrated snapshot in reconciliation notes.

## Closed in this pass

- Test artifacts removed from staging transactional modules.
- Wallet snapshot drift fixed and re-synced (`Employee.walletBalance` vs latest `WalletLedger`).
- Expense -> wallet/project/accounts and procurement/AP posting link checks are consistent on live staging data.

