# Codex Delta Verification Closure - 2026-03-12

Source audit: `codex_delta_verification_audit_2026-03-12.md`

## Critical finding closure status

1. Salary advance model lacked partial recovery lifecycle
- Status: CLOSED
- Implemented in:
  - `prisma/schema.prisma`
  - `src/lib/payroll-policy.ts`
  - `src/lib/payroll-settlement.ts`
  - `src/app/api/salary-advances/*`
- Result:
  - Added `issuedAmount`, `recoveredAmount`, `outstandingAmount`, `recoveryMode`, `installmentAmount`, lifecycle timestamps.
  - Added `SalaryAdvanceRecovery` rows linked to payroll entries.
  - Payroll policy deducts recoverable outstanding (installment-aware), not full original amount.

2. Payroll settlement modeled as wallet credit
- Status: CLOSED
- Implemented in:
  - `src/lib/payroll-settlement.ts`
  - `src/app/api/payroll/runs/[id]/entries/[entryId]/mark-paid/route.ts`
  - `src/components/PayrollEntrySettlementDialog.tsx`
  - `src/lib/accounting.ts`
- Result:
  - Payroll mark-paid now requires disbursement context (`paymentMode`, `companyAccountId`, `paymentReference`).
  - No automatic salary wallet top-up on normal payroll settlement.
  - Payroll payment posts accounting entry with source `PAYROLL_PAYMENT`.

3. Incentive/commission duplicate and mixed settlement semantics
- Status: CLOSED
- Implemented in:
  - `src/app/api/incentives/route.ts`
  - `src/app/api/incentives/[id]/route.ts`
  - `src/app/api/commissions/route.ts`
  - `src/app/api/commissions/[id]/route.ts`
- Result:
  - `PAYROLL` path remains unsettled until payroll settlement.
  - `WALLET` path settles via wallet only.
  - Middleman payout enforced through AP mode only.
  - Commission delete restricted to `PENDING` only.

4. Posted-document correction was missing ("use reversal later")
- Status: CLOSED in implemented scope
- Implemented in:
  - `src/app/api/procurement/grn/[id]/route.ts`
  - `src/app/api/procurement/vendor-bills/[id]/route.ts`
  - `src/app/api/procurement/vendor-payments/[id]/route.ts`
- Result:
  - Added controlled reversal behavior for posted docs (supports `REVERSE` action and `VOID` on posted by reversal path):
    - Posted GRN: creates inventory reversal ledger rows, updates inventory balances, voids GRN.
    - Posted Vendor Bill: creates reversal journal, marks original journal/batch reversed, voids bill.
    - Posted Vendor Payment: creates reversal journal, marks original journal/batch reversed, voids payment.

## Safety/policy mismatches from audit

1. `hardDeleteProjectCascade` dangerous path
- Status: CLOSED
- Removed from delete flow and hard-delete blocked for linked projects.

2. Project linked-record action labels still "Delete"
- Status: CLOSED
- Linked-record API uses review-oriented labels and blocks destructive delete.

3. Export package security hygiene
- Status: CLOSED
- `export:dev-zip` excludes `.env*`, Playwright auth/report artifacts, `.claude/*`, `*.tsbuildinfo`, `*.DS_Store`.

## Verification evidence

Local quality checks:
- `pnpm typecheck` ✅
- `pnpm vitest run src/lib/__tests__/validation.test.ts src/lib/__tests__/projects.test.ts src/lib/__tests__/wallet.test.ts src/lib/__tests__/approvals.test.ts` ✅
- `pnpm build` ✅

Focused staging checks (Playwright):
- `playwright/tests/procurement-inventory-controls.spec.ts` ✅
- `playwright/tests/payroll-settlement-smoke.spec.ts` ✅

## Residual notes

- Out-of-scope modules from master plan remain out-of-scope in this closure.
- Additional role-wise full deep-audit execution is still recommended before production cutover.
