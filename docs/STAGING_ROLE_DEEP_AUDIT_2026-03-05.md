# Staging Deep Role Audit - Discrepancies Only

- Generated: 2026-03-05
- Scope: Finance (finance1@automatrix.pk), Engineering (engineer1@automatrix.pk), Sales (sales1@automatrix.pk), Store (store1@automatrix.pk)
- Base URL: `https://erp-staging.automatrix.pk`
- Suite:
  - `playwright/tests/dashboard-approvals-mobile-smoke.spec.ts`
  - `playwright/tests/mobile-role-navigation.spec.ts`
  - `playwright/tests/payroll-deep-audit.spec.ts`
- Execution: `pnpm -s playwright test -c playwright.config.staging.ts ...`
- Summary: CRITICAL 0, HIGH 0, MEDIUM 0, LOW 0

## Findings

- No discrepancies detected in this audit pass.

## Evidence Notes

- Dashboard KPI cards and approvals mobile actions are visible and actionable for finance role.
- Mobile role navigation gates are correct for finance/engineering/sales/store profiles.
- Payroll deep checks passed: salary-advance lock rule behavior and payroll policy signal path.
