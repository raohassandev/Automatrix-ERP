# Help + RBAC Flow Audit (Pages and Forms)

Date: 2026-03-29  
Environment: local codebase + staging validation (`https://erp-staging.automatrix.pk`)

## Objective

Validate that pages/forms have contextual help coverage and that RBAC flow guardrails are functioning across route/page/form paths.

## Changes Implemented

1. Expanded contextual help catalog and route mapping in `src/lib/feature-help.ts`:
   - Added help domains:
     - `accounting`
     - `master-data`
     - `controls-ops`
   - Added explicit route-family mappings so non-public pages do not silently fall back to generic dashboard help:
     - `/accounting*`, `/company-accounts*` -> `accounting`
     - `/master-data*`, `/clients*`, `/vendors*`, `/categories*`, `/departments*`, `/designations*`, `/admin/users*` -> `master-data`
     - `/approvals*`, `/audit*`, `/data-ops*`, `/notifications*`, `/attachments*` -> `controls-ops`
     - `/hrms*` -> `employees`
     - `/invoices*`, `/quotations*` -> `income`

2. Added automated coverage tests:
   - `src/lib/__tests__/feature-help-coverage.test.ts`
     - scans all `src/app/**/page.tsx` routes
     - enforces contextual help mapping for every non-dashboard route
   - `src/lib/__tests__/rbac-page-guard-coverage.test.ts`
     - scans all pages for auth/permission guard signals
     - ensures non-public pages include RBAC/auth gating patterns

3. Retained and reran route-level RBAC policy tests already added in current cycle:
   - `src/lib/__tests__/data-ops-job-route.test.ts`
   - `src/lib/__tests__/company-account-attachments-route.test.ts`

## Evidence (Automated)

### Unit/Route Coverage

Command:

- `pnpm vitest run src/lib/__tests__/feature-help-coverage.test.ts src/lib/__tests__/rbac-page-guard-coverage.test.ts src/lib/__tests__/data-ops-job-route.test.ts src/lib/__tests__/company-account-attachments-route.test.ts src/lib/__tests__/payroll-run-route.test.ts src/lib/__tests__/procurement-attachment-policy.test.ts`

Result:

- `6/6` test files passed
- `21/21` tests passed

### Type Safety

Command:

- `pnpm typecheck`

Result:

- pass

### Staging RBAC Flow Validation

Command:

- `pnpm qa:staging:postgreen`

Result:

- effective permissions parity: pass (`noOverrideMismatchCount: 0`)
- project financial consistency: pass (`driftCount: 0`)
- critical suite: `41/41` pass
- mobile expense smoke: `1/1` pass
- strict vendor/item/workhub RBAC gate (`--workers=1 --retries=0`): `10/10` pass

## Conclusion

- Contextual help coverage is now explicit across page families and enforced by automated route coverage tests.
- RBAC flow guardrails remain operational at page and API levels, with staging postgreen suite passing in full.
- Current scope status: **audit-closed for help + RBAC flow verification on implemented modules**.
