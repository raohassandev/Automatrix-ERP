# Implementation Report — 2026-03-01 (Accounting Backbone Acceleration)

## Scope delivered in this pass

1. Locked owner-driven execution upgrades in master plan (`cash-first`, `double-entry`, `fast-track sprints).
2. Added double-entry accounting schema and migration:
   - `GlAccount`, `FiscalPeriod`, `PostingBatch`, `JournalEntry`, `JournalLine`
3. Added accounting posting service with idempotent source posting and debit/credit balance checks.
4. Wired procurement posting into double-entry:
   - Vendor Bill POST -> Journal (Dr Inventory/Purchase Expense, Cr AP)
   - Vendor Payment POST -> Journal (Dr AP, Cr Cash/Bank)
5. Added accounting defaults to seed:
   - Core GL chart accounts for assets/liabilities/income/expense controls.
6. Added accounting APIs:
   - COA: `GET/POST /api/accounting/accounts`, `GET/PATCH/DELETE /api/accounting/accounts/[id]`
   - Journals: `GET /api/accounting/journals`, `GET /api/accounting/journals/[id]`
   - Fiscal periods: `GET/POST /api/accounting/fiscal-periods`, `PATCH /api/accounting/fiscal-periods/[id]` (`CLOSE`/`REOPEN`)
7. Added accounting UI pages:
   - `/accounting/accounts`
   - `/accounting/journals`
   - `/accounting/journals/[id]`
   - `/accounting/fiscal-periods`
8. Added accounting reporting base + pages:
   - Trial Balance API/page/export
   - Profit & Loss API/page
   - Balance Sheet API/page
9. Updated navigation and permissions for accounting surfaces.

## Validation run

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅

## Notes / next execution block

1. Add AR posting chain and customer receipt allocations into journals.
2. Add period-close override workflow (owner reason + explicit override audit action).
3. Add financial statement exports and reconciliation checks (TB ↔ P&L ↔ Balance Sheet).
4. Expand e2e coverage for accounting posting assertions on procurement chain.

---

## Update — Staging credentials login hardening (QA/Playwright support)

### What changed

1. Added credentials-mode guard utility:
   - `src/lib/auth-credentials-guard.ts`
   - Allows email/password login only when `AUTH_ENABLE_CREDENTIALS=1` and `NEXTAUTH_URL` is staging domain or localhost.
   - Hard-blocks credentials mode on production domain.
2. Enforced guard in auth bootstrap:
   - `src/lib/auth.ts` now uses `assertCredentialsModeAllowed` + `isCredentialsModeAllowed`.
3. Enforced guard in password reset API:
   - `src/app/api/users/reset-password/route.ts` returns `403` when credentials mode is not allowed.
4. Login page now uses server-truth for credentials visibility:
   - `src/app/login/page.tsx` computes `credentialsEnabled` server-side.
   - `src/app/login/LoginClient.tsx` receives the flag via props.
5. Employee access UI now uses server-truth and supports deterministic temporary password:
   - `src/app/api/employees/access/route.ts` returns `credentialsEnabled`.
   - `src/components/EmployeeAccessManager.tsx` uses template password input for staging QA users.
6. Added unit tests:
   - `src/lib/__tests__/auth-credentials-guard.test.ts`

### Validation

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅

---

## Update — Cash controls + accounting backfill safety

### What changed

1. Added expense journal posting coverage:
   - New helper: `postExpenseApprovalJournal(...)` in `src/lib/accounting.ts`
   - Wired into:
     - `src/lib/approval-engine.ts` (expense approval posts journals)
     - `src/app/api/expenses/route.ts` (owner auto-approved expenses post journals)
     - `src/app/api/expenses/[id]/mark-as-paid/route.ts` (idempotent posting on mark-as-paid)

2. Added safe accounting backfill engine for existing real records:
   - `src/lib/accounting-backfill.ts`
   - Admin API: `POST /api/accounting/backfill`
   - Supports dry-run and apply modes; idempotent via `PostingBatch(sourceType, sourceId)`.
   - Covers missing journals for:
     - Income
     - Invoice
     - Expense
     - Vendor Bill
     - Vendor Payment

3. Added owner cash visibility report:
   - Data service: `getCashPosition(...)` in `src/lib/accounting-reports.ts`
   - API: `GET /api/reports/accounting/cash-position`
   - Export API: `GET /api/reports/accounting/cash-position/export`
   - UI page: `/reports/accounting/cash-position`
   - Added navigation links in reports and sidebar.

4. Strengthened Playwright procurement-chain assertions:
   - `playwright/tests/rb4-procurement-chain.spec.ts`
   - Now verifies:
     - journal exists for posted vendor bill (`sourceType=VENDOR_BILL`)
     - journal exists for posted vendor payment (`sourceType=VENDOR_PAYMENT`)
     - debit/credit equality on those journals
     - reconciliation endpoint reports balanced trial balance

### Operational note

- Backfill endpoint is designed to preserve existing entries and add missing journals without deleting/changing source business documents.

### Staging execution snapshot (Hostinger VPS)

1. Seeded GL defaults on staging (`pnpm prisma:seed`) to enable posting.
2. Ran accounting backfill on staging data:
   - Dry-run: candidates `38` (`7` income + `31` expense), with `7` income skipped due missing `companyAccountId`.
   - Apply-run: created `31` expense journals + posting batches; no source record deletions.
3. Post-run DB state:
   - `JournalEntry=31`, `JournalLine=62`, `PostingBatch=31` (`sourceType=EXPENSE`).
4. Staging availability fix:
   - Corrected staging runtime port mismatch (`PM2 3031` vs `Nginx 3001`).
   - Staging app now bound to `127.0.0.1:3001` and `https://staging.automatrix.pk/api/health` returns `200`.

---

## Update — AR aging + cash forecast + income backfill completion

### What changed

1. Backfill safety/coverage upgrade:
   - `src/lib/accounting-backfill.ts`
   - `src/app/api/accounting/backfill/route.ts`
   - Added:
     - safe posting user resolution (falls back to `null` if invalid)
     - optional `autoAssignIncomeCompanyAccount` to patch legacy approved incomes missing `companyAccountId` before posting journals

2. Added AR aging reporting surfaces:
   - API: `GET /api/reports/accounting/ar-aging`
   - Export: `GET /api/reports/accounting/ar-aging/export`
   - UI: `/reports/accounting/ar-aging`

3. Added cash forecast reporting surfaces:
   - API: `GET /api/reports/accounting/cash-forecast`
   - UI: `/reports/accounting/cash-forecast`
   - Shows 14-day and 30-day expected receipts vs planned disbursements.

4. Navigation/report home updated for new accounting/treasury reports.

---

## Update — Usability-first form logic and UI pass (owner request)

### What changed

1. Finance form UX/logic hardening:
   - `src/components/ExpenseForm.tsx`
   - Added plain-language guidance, replaced alert popups with toasts, stricter validations.
   - Added company account selector when payment source is `COMPANY_ACCOUNT` (previously missing in create form path).

2. Procurement accounting form UX:
   - `src/components/VendorBillFormDialog.tsx`
   - `src/components/VendorPaymentFormDialog.tsx`
   - Added clearer guidance copy, stronger required-field checks, cleaner payload trimming, and allocation clarity (`Unallocated` amount indicator).
   - Vendor bill now defaults due date to Net 30 if left empty.

3. Inventory/project/employee/payroll form clarity:
   - `src/components/InventoryFormDialog.tsx`
   - `src/components/ProjectFormDialog.tsx`
   - `src/components/EmployeeFormDialog.tsx`
   - `src/components/SalaryAdvanceFormDialog.tsx`
   - `src/components/PayrollRunFormDialog.tsx`
   - Added plain-language helper sections + validation hardening (non-negative numeric checks, date sanity, deduction-reason requirement when deductions > 0).

### Validation

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅
- `playwright/tests/rb4-procurement-chain.spec.ts` ✅

### Staging

- Deployed to ERP staging and verified:
  - `https://erp-staging.automatrix.pk/api/health` returns `200 OK`.

---

## Update — AR posting + accounting statement exports

### What changed

1. Added reusable accounting posting helpers:
   - `postIncomeApprovalJournal(...)`
   - `postInvoiceJournal(...)`
   - file: `src/lib/accounting.ts`

2. Income posting is now journal-backed:
   - `src/lib/approval-engine.ts`:
     - approving income now writes posting journal (cash/bank vs revenue/AR depending on invoice linkage)
   - `src/app/api/income/route.ts`:
     - auto-approved income creates journal immediately
   - `src/app/api/income/[id]/route.ts`:
     - auto-approve-on-edit also creates journal

3. Invoice posting is now journal-backed:
   - `src/app/api/invoices/route.ts`:
     - if invoice is created in non-draft status, AR + revenue journal is posted
   - `src/app/api/invoices/[id]/route.ts`:
     - draft -> non-draft transition posts AR + revenue journal
   - Idempotency is preserved through `PostingBatch(sourceType, sourceId)`.

4. Added accounting statement export APIs:
   - `src/app/api/reports/accounting/profit-loss/export/route.ts`
   - `src/app/api/reports/accounting/balance-sheet/export/route.ts`
   - with audit actions:
     - `EXPORT_PROFIT_LOSS_CSV`
     - `EXPORT_BALANCE_SHEET_CSV`

5. Added reconciliation check API:
   - `src/app/api/reports/accounting/reconciliation/route.ts`
   - Returns trial-balance and balance-sheet consistency checks.

6. Added export buttons in report UI pages:
   - `src/app/reports/accounting/profit-loss/page.tsx`
   - `src/app/reports/accounting/balance-sheet/page.tsx`

### Validation

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅
