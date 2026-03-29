# Production Cutover Checklist (Implemented Modules)

Date: 2026-03-28  
Environment source: `erp-staging.automatrix.pk`  
Decision owner: Owner/CEO + Finance controller

## 1) Pre-cutover Preconditions

- [x] Latest deploy/build baseline validated on staging.
- [x] `verify:staging:effective-permissions` green (`2026-03-28T17:14:38.976Z`).
- [x] `verify:projects:financial-consistency` green (`2026-03-28T17:14:39.379Z`).
- [x] Full postgreen suite executed and green (`41/41` + `1/1` + strict `10/10`).
- [x] Staging rollback drill executed and recovered to start commit.
  - Evidence: `docs/ROLLBACK_DRILL_LOG_20260328-170637.txt`
- [x] Staging test-artifact cleanup executed and verified to zero scoped rows.
  - Evidence: `docs/STAGING_TEST_ARTIFACT_CLEANUP_20260328-120626.txt`

## 2) Data Safety (Production-day Manual)

- [ ] Full production DB snapshot created immediately before cutover.
- [ ] Restore drill validated from same snapshot policy/version.
- [ ] Migration plan reviewed against production schema/version.
- [ ] Rollback trigger conditions confirmed (time-box + health thresholds).

## 3) Deploy Sequence (Production)

1. Freeze writes window.
2. Snapshot DB and app config.
3. Deploy app revision.
4. Run `pnpm prisma:migrate:deploy`.
5. Restart app process.
6. Run smoke tests:
   - login + role menu parity
   - dashboard + approvals
   - expense submit -> approval
   - project financial snapshot
   - payroll run list + detail
7. If any blocker, execute rollback runbook.

## 4) Post-cutover Validation

- [ ] Owner/CEO dashboard numbers reconcile with staging reference.
- [ ] Finance validates AP outstanding + cash position + payroll queue.
- [ ] Engineering manager validates assigned project access + expense flow.
- [ ] Procurement validates PO -> GRN -> vendor bill -> payment chain.

## 5) Current Decision Status

- Staging readiness for implemented modules: `GO`
- Production cutover now: `CONDITIONAL GO` (execute only after Section 2 + 4 manual checkpoints are signed)
- Residual risk tracked: none open in implemented module scope for this pass.
