# Production Cutover Checklist (Implemented Modules)

Date: 2026-03-13  
Environment source: `erp-staging.automatrix.pk`  
Decision owner: Owner/CEO + Finance controller

## 1) Pre-cutover Preconditions

- [x] Latest dev deploy green on staging (GitHub Actions `deploy-staging.yml`).
- [x] `verify:staging:effective-permissions` green.
- [x] `verify:projects:financial-consistency` green.
- [x] Critical staging Playwright suite executed with passing rerun.
- [x] No destructive cleanup script executed against real staging data.

## 2) Data Safety

- [ ] Full production DB snapshot created immediately before cutover.
- [ ] Restore drill completed on non-production target from the same snapshot.
- [ ] Migration plan reviewed against production schema/version.
- [ ] Rollback trigger conditions agreed (time-box + health thresholds).

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
- Residual risk tracked: one minor staging flake in inventory-detail navigation test (no reproduced data/logic defect)
