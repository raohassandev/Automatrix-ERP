# Staging Post-Green Audit (Discrepancy-Only)

Date: 2026-03-09  
Environment: `https://erp-staging.automatrix.pk`

## Executed checks

1. Effective permission parity:
   - `pnpm verify:staging:effective-permissions`
   - Result: `17` users checked, `0` mismatches.
2. Deep role + cross-module audit:
   - `playwright/tests/role-deep-audit.spec.ts`
   - `playwright/tests/staging-deep-audit.spec.ts`
   - Result: `7/7` passed.
3. Full post-green regression:
   - `pnpm qa:staging:postgreen`
   - Result after test hardening: all stages green (`40/40` critical fast, mobile smoke pass, vendor/item/project suite `10/10`).
4. Test artifact cleanup:
   - Dry run: `pnpm ops:staging:cleanup:test-artifacts:dry`
   - Execute: `pnpm ops:staging:cleanup:test-artifacts`
   - Result: matched artifacts deleted and post-verify rows reduced to `0` for scoped entities.
   - Evidence: `docs/STAGING_TEST_ARTIFACT_CLEANUP_20260309-100124.txt`

## Open discrepancies

### 1) Legacy project snapshot reconciliation exception
- Severity: Medium
- Reference project: `PV-89`
- Observation:
  - Legacy project snapshot totals do not fully map to current approved income rows.
- Impact:
  - Reconciliation reports can show one historical mismatch row.
- Status:
  - Open by design until owner decides legacy treatment.
- Resolution path:
  1. Create explicit legacy opening income entries, or
  2. Mark as legacy migrated snapshot exception in reconciliation governance notes.

## Closed in this pass

- Dashboard mobile KPI locator ambiguity fixed in smoke suite.
- Staging login race in Playwright auth helper hardened.
- Post-green suite rerun passed after hardening.
- Staging cleanup executed and verified with zero scoped test rows remaining.
