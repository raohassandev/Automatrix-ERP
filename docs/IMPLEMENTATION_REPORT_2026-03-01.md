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
