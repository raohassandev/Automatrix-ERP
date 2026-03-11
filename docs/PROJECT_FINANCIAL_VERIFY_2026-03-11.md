# Project Financial Consistency Verification
Date: 2026-03-11
Command: `PROJECT_FINANCIAL_MAX=200 pnpm verify:projects:financial-consistency`

## Result Snapshot
- tolerance: `1`
- projectCount: `5`
- driftCount: `1`
- unresolved income refs: `0`
- unresolved expense refs: `0`

## Drift Candidate
- Project: `AE-MON-CI-90` (`ZKB Form House Project`)
- Field mismatch:
  - `pendingRecovery`: stored `0`, computed `400000` (delta `400000`)

## Reconciliation Path
1. Dry run: `pnpm ops:projects:financials:dry`
2. Apply controlled update: `pnpm ops:projects:financials:apply`
3. Re-verify: `pnpm verify:projects:financial-consistency`

## Post-Reconciliation Verification (2026-03-12)
- Command: `pnpm verify:projects:financial-consistency`
- Result:
  - projectCount: `5`
  - driftCount: `0`
  - unresolved income refs: `0`
  - unresolved expense refs: `0`
