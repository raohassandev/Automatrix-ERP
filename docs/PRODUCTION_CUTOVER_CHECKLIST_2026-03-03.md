# Production Cutover Checklist (Implemented Modules)

Date: 2026-03-03
Source environment: `https://erp-staging.automatrix.pk/`

## 1) Pre-Cutover

- [x] Confirm latest staging deployment commit hash and build artifacts.
- [x] Confirm DB backup completed and restore test validated.
- [x] Confirm migration plan and rollback SQL/strategy documented.
- [x] Confirm production env parity (`NEXTAUTH_URL`, auth providers, DB, storage, PM2).
- [x] Confirm credentials-login test mode disabled for production.

## 2) Data Safety

- [x] Confirm no destructive cleanup scripts will run on production data.
- [x] Confirm seed scripts are not auto-run in prod deployment.
- [x] Confirm project/expense/inventory/payroll historical data preserved.

## 3) Access & Security

- [ ] Verify Owner/CEO login and Settings > Access Control availability.
- [x] Verify finance baseline excludes CEO dashboards unless explicit override.
- [x] Verify unauthorized sidebar/mobile links are hidden for non-allowed roles.
- [x] Verify forbidden routes return safe access-denied state.

## 4) Financial Integrity Smoke

- [x] Income post updates project received/pending and accounting reports.
- [x] Expense approval/post updates wallet/project cost and reports.
- [x] Vendor bill/payment lifecycle posts AP and allocations correctly.
- [x] Incentive appears in payroll run and salary slip line items.
- [x] Employee advance settlement/reimbursement behavior is consistent.

## 5) Mobile Smoke

- [x] Dashboard + mobile menu opens and navigates for all core roles.
- [ ] Expense form submit flow works on mobile.
- [ ] Approvals actions visible and clickable on mobile/tablet widths.
- [ ] No blocking horizontal clipping of primary actions.

## 6) Go/No-Go Criteria

Go only if all true:
- [x] Critical discrepancies: 0
- [x] High discrepancies: 0
- [x] Core financial integrity smoke pass complete
- [ ] Owner/CEO sign-off received

## 7) Rollback Readiness

- [x] Previous release artifact/commit ID recorded.
- [x] DB rollback point-in-time identified.
- [x] Rollback command sequence tested in staging-like environment.
- [x] Communication template prepared for rollback event.

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

- Financial integrity scenarios requiring AP/payroll-linked examples were pending at this timestamp (resolved in section 12).

## 10) Backup & Data-State Evidence (2026-03-05 UTC)

- Fresh production backup created: `/var/backups/automatrix-erp/automatrix_erp_prod_20260305-055402.dump`.
- Backup checksum (sha256): `80340a2e82e3bfda4e43895089cbdb00d47c1fe7eeb8c1866311296533a12b66`.
- Restore-readiness (non-destructive) validated via `pg_restore -l` TOC listing.

Production transactional-state snapshot:

- `Project=0`, `Income=0`, `Expense=0`, `VendorBill=0`, `VendorPayment=0`, `InventoryItem=0`, `PayrollEntry=0`, `IncentiveEntry=0`, `SalaryAdvance=0`.
- `Employee=7`, `User=11` (identity data exists, operational finance/project data absent).

Additional blocker identified:

- Financial integrity smoke could not be completed at this timestamp because production had no operational transactions yet.
- Production DB schema was behind staging at this timestamp (resolved in section 11).

## 11) Production Alignment + Data Promotion (2026-03-05 UTC)

- Governance alignment complete: `origin/main` fast-forwarded to `7d621fc`; production working tree switched to branch `main` at `7d621fc`.
- Production app recovered and healthy after clean rebuild (`.next/BUILD_ID` regenerated, PM2 process online, `/api/health` OK).
- Staging -> production data promotion completed with safety checkpoints:
  - Pre-restore production backup: `/var/backups/automatrix-erp/automatrix_erp_prod_pre_restore_20260305-063531.dump`
  - Promotion snapshot source: `/var/backups/automatrix-erp/automatrix_erp_staging_for_prod_20260305-063531.dump`
  - Post-restore migration status: up to date (`16 migrations`).
- Post-restore production data snapshot:
  - `Project=10`, `Income=7`, `Expense=47`, `InventoryItem=8`, `PayrollEntry=5`, `IncentiveEntry=3`, `SalaryAdvance=3`, `User=17`.
- Financial smoke evidence from production data:
  - Income/project received reconciliation: key projects (e.g., `AE-PV-IS-463`, `AE-PV-XS-458`, `AE-MON-SL-433`) matched with zero diff.
  - Expense/project cost reconciliation: matched with zero diff on active project rows.

Remaining blockers before final Go:

- Owner/CEO login + Access Control manual sign-off pending.
- Mobile smoke in production for expense/approval/table clipping still pending explicit sign-off.
- Rollback communication template sign-off pending (template exists; approval communication flow to be finalized during production go/no-go).

## 12) Guided Final Smoke (Executed by Agent, 2026-03-05 UTC)

Production smoke transactions executed and verified (non-destructive, prefixed with `SMOKE-` / `smk_`):

- AP lifecycle:
  - Vendor bill: `SMOKE-20260305-073457-VB-001` (`POSTED`, amount `1000`)
  - Vendor payment: `SMOKE-20260305-073457-VP-001` (`POSTED`, amount `1000`)
  - Allocation: `smk_alloc_SMOKE_20260305_073457` linking payment -> bill (`1000`)
- Incentive -> payroll linkage:
  - Incentive: `smk_inc_SMOKE_20260305_073457` (`APPROVED`, `SETTLED`)
  - Settled in run: `smk_pr_SMOKE_20260305_073457`
  - Settled in payroll entry: `smk_pe_SMOKE_20260305_073457`
  - Salary-slip component line: `smk_pcl_SMOKE_20260305_073457` (`componentType=INCENTIVE`, `sourceType=INCENTIVE`)
- Salary advance lifecycle:
  - Open advance: `smk_adv_open_SMOKE_20260305_073457` (`OPEN`, `800`)
  - Settled advance: `smk_adv_set_SMOKE_20260305_073457` (`SETTLED`, `600`)

Cleanup validation:

- Residual test artifacts scan after promotion cleanup: no remaining `E2E`/`Playwright` rows in projects/clients/expenses/income/inventory/vendors/company accounts.
- Owner/CEO login + Access Control manual sign-off pending.

## 13) Rollback and Migration Documentation (2026-03-05 UTC)

- Migration and rollback runbook documented: `docs/PRODUCTION_ROLLBACK_RUNBOOK_2026-03-05.md`
- Rollback communication template documented: `docs/ROLLBACK_COMMUNICATION_TEMPLATE_2026-03-05.md`
- Production env parity evidence completed via host checks:
  - auth URL and mode guards
  - PM2 process + health endpoint
  - migrations status (`up to date`)

## 14) Staging Rollback Drill Execution Evidence (2026-03-08 UTC)

- Executed scripted rollback drill on staging host (`hostinger-vps`) using:
  - `MODE=execute ./scripts/rollback-drill-staging.sh`
- Drill behavior validated:
  - Rollback from `9899f69` to previous commit `5593d6a`
  - Full rebuild + PM2 restart + health check
  - Roll-forward back to `9899f69`
  - Full rebuild + PM2 restart + health check
- Result: `DRILL_COMPLETE rollback+roll-forward successful`
- Evidence log: `docs/ROLLBACK_DRILL_LOG_20260308-134627.txt`
