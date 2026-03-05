# Production Cutover Checklist (Implemented Modules)

Date: 2026-03-03
Source environment: `https://erp-staging.automatrix.pk/`

## 1) Pre-Cutover

- [x] Confirm latest staging deployment commit hash and build artifacts.
- [x] Confirm DB backup completed and restore test validated.
- [ ] Confirm migration plan and rollback SQL/strategy documented.
- [ ] Confirm production env parity (`NEXTAUTH_URL`, auth providers, DB, storage, PM2).
- [x] Confirm credentials-login test mode disabled for production.

## 2) Data Safety

- [x] Confirm no destructive cleanup scripts will run on production data.
- [x] Confirm seed scripts are not auto-run in prod deployment.
- [ ] Confirm project/expense/inventory/payroll historical data preserved.

## 3) Access & Security

- [ ] Verify Owner/CEO login and Settings > Access Control availability.
- [x] Verify finance baseline excludes CEO dashboards unless explicit override.
- [x] Verify unauthorized sidebar/mobile links are hidden for non-allowed roles.
- [x] Verify forbidden routes return safe access-denied state.

## 4) Financial Integrity Smoke

- [ ] Income post updates project received/pending and accounting reports.
- [ ] Expense approval/post updates wallet/project cost and reports.
- [ ] Vendor bill/payment lifecycle posts AP and allocations correctly.
- [ ] Incentive appears in payroll run and salary slip line items.
- [ ] Employee advance settlement/reimbursement behavior is consistent.

## 5) Mobile Smoke

- [x] Dashboard + mobile menu opens and navigates for all core roles.
- [ ] Expense form submit flow works on mobile.
- [ ] Approvals actions visible and clickable on mobile/tablet widths.
- [ ] No blocking horizontal clipping of primary actions.

## 6) Go/No-Go Criteria

Go only if all true:
- [x] Critical discrepancies: 0
- [x] High discrepancies: 0
- [ ] Core financial integrity smoke pass complete
- [ ] Owner/CEO sign-off received

## 7) Rollback Readiness

- [x] Previous release artifact/commit ID recorded.
- [x] DB rollback point-in-time identified.
- [ ] Rollback command sequence tested in staging-like environment.
- [ ] Communication template prepared for rollback event.

## 8) Validation Evidence (2026-03-03 post-deploy)

- Deep role audit: `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` => `CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0`.
- Mobile role smoke: `playwright/tests/mobile-role-navigation.spec.ts` => passed.
- Inventory RBAC smoke: `playwright/tests/inventory-rbac-actions.spec.ts` => passed.
- Project detail/report RBAC regression: `playwright/tests/project-detail-rbac.spec.ts` => passed (updated for locked role baseline).

## 9) Production Read-Only Verification (2026-03-03 UTC)

Executed non-destructive checks on host `srv1225231`:

- PM2/app health: `automatrix-erp-prod` online, uptime `20D`, health endpoint `{"ok":true,"db":"up"}`.
- Runtime env evidence: `NODE_ENV=production`, `NEXTAUTH_URL="https://erp.automatrix.pk"`, Google client ID present in `.env`.
- Credentials mode guard validated: `AUTH_ENABLE_CREDENTIALS` is not set in prod `.env`; code only enables credentials when `AUTH_ENABLE_CREDENTIALS=1` and staging/localhost URL (`src/lib/auth-credentials-guard.ts`).
- Deployment workflow safety: production workflow runs `pnpm prisma:migrate:deploy`; no `prisma db seed` or cleanup script in workflow.
- Previous release commit recorded (for rollback reference): current prod app commit `94ce615`; previous commit `cbb2211`.

Open blockers identified:

- Branch/source mismatch for cutover governance: prod repo currently on branch `dev` at `94ce615`, while `origin/main` is `a97ccff`. Must align deployment source-of-truth before final cutover sign-off.

## 10) Backup & Data-State Evidence (2026-03-05 UTC)

- Fresh production backup created: `/var/backups/automatrix-erp/automatrix_erp_prod_20260305-055402.dump`.
- Backup checksum (sha256): `80340a2e82e3bfda4e43895089cbdb00d47c1fe7eeb8c1866311296533a12b66`.
- Restore-readiness (non-destructive) validated via `pg_restore -l` TOC listing.

Production transactional-state snapshot:

- `Project=0`, `Income=0`, `Expense=0`, `VendorBill=0`, `VendorPayment=0`, `InventoryItem=0`, `PayrollEntry=0`, `IncentiveEntry=0`, `SalaryAdvance=0`.
- `Employee=7`, `User=11` (identity data exists, operational finance/project data absent).

Additional blocker identified:

- Financial integrity smoke cannot be completed on production because there are no operational transactions to validate cross-module posting behavior.
- Production DB schema is older than staging in incentive/payroll linkage fields (e.g., no `settledInPayrollRunId`/`settledInPayrollEntryId` on `IncentiveEntry`), so env/schema parity is not yet achieved.
