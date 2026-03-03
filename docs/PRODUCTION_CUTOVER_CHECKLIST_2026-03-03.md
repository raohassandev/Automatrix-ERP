# Production Cutover Checklist (Implemented Modules)

Date: 2026-03-03
Source environment: `https://erp-staging.automatrix.pk/`

## 1) Pre-Cutover

- [ ] Confirm latest staging deployment commit hash and build artifacts.
- [ ] Confirm DB backup completed and restore test validated.
- [ ] Confirm migration plan and rollback SQL/strategy documented.
- [ ] Confirm production env parity (`NEXTAUTH_URL`, auth providers, DB, storage, PM2).
- [ ] Confirm credentials-login test mode disabled for production.

## 2) Data Safety

- [ ] Confirm no destructive cleanup scripts will run on production data.
- [ ] Confirm seed scripts are not auto-run in prod deployment.
- [ ] Confirm project/expense/inventory/payroll historical data preserved.

## 3) Access & Security

- [ ] Verify Owner/CEO login and Settings > Access Control availability.
- [ ] Verify finance baseline excludes CEO dashboards unless explicit override.
- [ ] Verify unauthorized sidebar/mobile links are hidden for non-allowed roles.
- [ ] Verify forbidden routes return safe access-denied state.

## 4) Financial Integrity Smoke

- [ ] Income post updates project received/pending and accounting reports.
- [ ] Expense approval/post updates wallet/project cost and reports.
- [ ] Vendor bill/payment lifecycle posts AP and allocations correctly.
- [ ] Incentive appears in payroll run and salary slip line items.
- [ ] Employee advance settlement/reimbursement behavior is consistent.

## 5) Mobile Smoke

- [ ] Dashboard + mobile menu opens and navigates for all core roles.
- [ ] Expense form submit flow works on mobile.
- [ ] Approvals actions visible and clickable on mobile/tablet widths.
- [ ] No blocking horizontal clipping of primary actions.

## 6) Go/No-Go Criteria

Go only if all true:
- [ ] Critical discrepancies: 0
- [ ] High discrepancies: 0
- [ ] Core financial integrity smoke pass complete
- [ ] Owner/CEO sign-off received

## 7) Rollback Readiness

- [ ] Previous release artifact/commit ID recorded.
- [ ] DB rollback point-in-time identified.
- [ ] Rollback command sequence tested in staging-like environment.
- [ ] Communication template prepared for rollback event.
