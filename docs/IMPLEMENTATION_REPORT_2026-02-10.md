# Implementation Report — 2026-02-10 (Auth Lock + Staging Deploy)

**Author / Identity:** Codex (OpenAI), engineering agent for this repo  
**Branch:** `dev`  
**Primary goal:** Align code + deployment with `SOP.md` Phase 1 **LOCKED** auth/provisioning rules and ops defaults.

---

## 1) What was implemented (high signal)

### 1.1 Google OAuth only (Phase 1 locked)
- Removed credentials login and any hardcoded/dev credential bypass.
- Login UI is Google-only and works in production build (no client hook hydration issues).
- Unknown emails are denied at sign-in (no auto user/employee creation in prod).

### 1.2 Admin-provisioned allowlist (Employee-based)
- Allowlist rule implemented: an email can sign in only if there is an `Employee` record with the same email and `status=ACTIVE`.
- Existing user accounts with the same email are linked safely (Google-only).

### 1.3 Disabled “public signup” + “password reset”
- `/api/register`: disabled (410) with a clear message.
- `/api/users/reset-password`: disabled (410) because Phase 1 is OAuth-only.

### 1.4 Health endpoint for uptime monitoring
- Added `/api/health` (public) that checks DB connectivity.

### 1.5 RBAC hardening + server component correctness
- Removed the leftover **development bypass** in RBAC role resolution (`dev-admin-id`).
- Normalized all `page.tsx` files to treat `searchParams` as a plain object (Next.js behavior), removing incorrect `Promise<>` typing and `await searchParams` patterns.

---

## 2) Repo changes (files)

### Auth + allowlist
- `src/lib/auth.ts`
  - Google provider only.
  - Allowlist enforcement in `callbacks.signIn`.
  - Adapter wrapper enforces allowlist on first-time user creation.
  - Case-insensitive user lookup (`getUserByEmail`) to avoid email-case mismatches.

### Login UI
- `src/app/login/page.tsx` (server component: redirects if already logged in, passes `error` to client)
- `src/app/login/LoginClient.tsx` (client: Google sign-in button, simple error messaging)

### Provisioning UI/endpoint (role assignment only, no passwords)
- `src/app/api/employees/access/route.ts` (upsert user + role; forces `passwordHash=null`)
- `src/components/EmployeeAccessManager.tsx` (UI updated: OAuth-only provisioning)
- `src/components/UserManagementInterface.tsx` (removed password tools/login-as-user UX)

### Locked endpoints
- `src/app/api/register/route.ts` (410 disabled)
- `src/app/api/users/reset-password/route.ts` (410 disabled)

### Ops/quality
- `src/app/api/health/route.ts`
- `scripts/verify-env.js`
  - Loads `.env` for local/devops checks.
  - Requires: `DATABASE_URL`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus `AUTH_SECRET` or `NEXTAUTH_SECRET`.

### RBAC + page correctness
- `src/lib/rbac.ts` (removed dev-bypass role mapping)
- Multiple `src/app/**/page.tsx` pages (correct `searchParams` typing/usage)

### Prisma schema + migrations
- `prisma/schema.prisma`: added `User.emailVerified` (nullable) required by Auth.js OAuth flow.
- `prisma/migrations/20260206102211_init/migration.sql` (init migration)
- `prisma/migrations/20260210090630_add_user_email_verified/migration.sql` (adds `emailVerified`)

---

## 3) Database impact (safe + additive)

### Migration applied
- `20260210090630_add_user_email_verified`
  - SQL: `ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);`
  - Additive only; **no data loss**.

---

## 4) Staging deployment performed (Hostinger VPS)

### Target
- **Host:** `ssh hostinger-vps`
- **App dir:** `/var/www/automatrix-erp-staging`
- **PM2 app:** `automatrix-erp-staging`
- **Bind/port:** `127.0.0.1:3031`
- **Domain:** `https://erp-staging.automatrix.pk`

### Environment config (staging)
Updated `/var/www/automatrix-erp-staging/.env` to include (values redacted):
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `NEXTAUTH_URL="https://erp-staging.automatrix.pk"`
- `NEXTAUTH_SECRET=...`
- `DATABASE_URL=...`
- `NODE_ENV=production`

### Deploy steps executed (in order)
1. Pulled latest `dev` branch into `/var/www/automatrix-erp-staging`.
2. `pnpm install --frozen-lockfile`
3. `pnpm security:check`
4. **Required extra step (important):** `pnpm prisma:generate`
   - Without this, `pnpm build` failed due to stale Prisma Client types after schema changes.
5. `pnpm build`
6. DB backup created (custom-format dump) under:
   - `/var/backups/automatrix-erp/automatrix_erp_staging_YYYYMMDD-HHMMSS.dump`
7. `pnpm prisma:migrate:deploy` (applied `20260210090630_add_user_email_verified`)
8. `pm2 restart automatrix-erp-staging`
9. Smoke tests:
   - `GET http://127.0.0.1:3031/api/health` returns `{ ok: true, db: "up" }`
   - `GET http://127.0.0.1:3031/api/auth/providers` includes `google`
   - `GET https://erp-staging.automatrix.pk/api/health` returns `200` (via Nginx)

### Deployment note (non-blocking)
Right after PM2 restart, `curl` can briefly return “connection refused” during the startup window. Retrying after 1–2 seconds succeeds.

### Server cleanup note (non-blocking)
During the deploy, local-only/untracked items that blocked git checkout were moved to:
- `/var/backups/automatrix-erp/staging-prepull-<timestamp>/...`

This was done to avoid overwriting untracked Prisma migrations. Safe to delete later if desired.

---

## 5) Operational instructions (how admins give access)

Phase 1 access model:
1. Admin creates the `Employee` record (email must match the user’s Google email).
2. Admin sets `Employee.status = ACTIVE`.
3. Admin provisions/updates the RBAC role using:
   - Settings → “Employee Access” → “Create Login / Update Role”
4. User signs in via Google on `/login`.

If the email is not allowlisted (no ACTIVE employee), sign-in is denied.

---

## 6) Planner-facing delta (what changed in plan terms)

- Auth is now strictly aligned with `SOP.md`:
  - Google OAuth only
  - Admin-provisioned allowlist
  - No public signup
  - No password reset in Phase 1
- Production ops now has a working `/api/health` endpoint for uptime monitoring.

---

## 7) Follow-up hardening (Next.js 16 compatibility + auth discipline)

### 7.1 Fix `searchParams` typing across app pages
- Updated page component props to treat `searchParams` as a plain object (not `Promise<...>`), matching Next.js app router behavior.
- Removed `await searchParams` usage accordingly to prevent runtime/type confusion.

### 7.2 Remove RBAC dev-bypass identity
- Removed the `dev-admin-id` bypass in RBAC (`getUserRoleName`). With OAuth-only + allowlist, dev/prod auth behavior must stay consistent.

### 7.3 Local quality gates executed
- `pnpm typecheck` OK
- `pnpm lint` OK
- `pnpm test` OK
- `pnpm build` OK

---

## 8) Phase 1 (M1) foundation — AP + Company Accounts + Posting Trace (Schema Only)

This change is **schema + migration only** (no UI/API yet), to align the codebase with `MASTER_PLAN_NEW.md` Phase 1 “Purchasing + Inventory spine”.

### 8.1 Added models (AP subledger, finance-lite)
- `VendorBill` + `VendorBillLine` (multi-line vendor bills)
- `VendorPayment` + `VendorPaymentAllocation` (payments with bill allocations)
- `CompanyAccount` (Cash/Banks list for attribution)

### 8.2 Added model for future-proof inventory
- `Warehouse` (single warehouse in Phase 1; InventoryLedger now has nullable `warehouseId` to avoid breaking existing real data)

### 8.3 Posting traceability fields (SOP non-negotiable)
Added nullable fields to posting/ledger tables so we can migrate flows safely:
- `InventoryLedger`: `sourceType`, `sourceId`, `postedById`, `postedAt`, `createdAt`, `warehouseId`
- `WalletLedger`: `sourceType`, `sourceId`, `postedById`, `postedAt`, `createdAt`

### 8.4 Migration applied locally (safe + additive)
- Migration: `20260210101457_ap_vendor_bill_payment_and_posting_trace`
- Only adds columns / new tables; **no drops**, **no data loss**

### 8.5 Seed defaults (safe)
Updated seed to ensure (only if missing):
- Warehouse: `Main Warehouse (MAIN)` as default
- Company accounts: `Cash`, `Bank`

---

## 9) Phase 1 (M1) foundation — Company Accounts API (RBAC + audit)

Implemented the backend API for Company Accounts so procurement/finance flows can attribute receipts/payments to Cash/Bank accounts.

### 9.1 RBAC permissions added
- `company_accounts.view`
- `company_accounts.manage`

Mapped to roles:
- Admin/CFO/Accountant/Finance Manager: view + manage
- Procurement/Store Keeper: view only

### 9.2 API routes added
- `GET /api/company-accounts` (view)
- `POST /api/company-accounts` (manage)
- `PUT /api/company-accounts/[id]` (manage)
- `DELETE /api/company-accounts/[id]` (manage; blocked if referenced by vendor payments)

### 9.3 Audit logging
All create/update/delete actions write audit log entries:
- `CREATE_COMPANY_ACCOUNT`
- `UPDATE_COMPANY_ACCOUNT`
- `DELETE_COMPANY_ACCOUNT`

---

## 10) Phase 1 (M1) — Vendor Bills + Vendor Payments (AP subledger-lite)

Implemented minimal but ERP-aligned AP flows:
- Vendor Bills (multi-line)
- Vendor Payments (with allocations to bills)
- Lifecycle actions: `DRAFT -> SUBMITTED -> APPROVED -> POSTED` (and `VOID`)

### 10.1 API routes
- Vendor Bills:
  - `GET /api/procurement/vendor-bills`
  - `POST /api/procurement/vendor-bills`
  - `GET /api/procurement/vendor-bills/[id]`
  - `PATCH /api/procurement/vendor-bills/[id]` (edit DRAFT + lifecycle actions)
  - `DELETE /api/procurement/vendor-bills/[id]` (DRAFT only)
- Vendor Payments:
  - `GET /api/procurement/vendor-payments`
  - `POST /api/procurement/vendor-payments`
  - `GET /api/procurement/vendor-payments/[id]`
  - `PATCH /api/procurement/vendor-payments/[id]` (edit DRAFT + lifecycle actions + posting validation)
  - `DELETE /api/procurement/vendor-payments/[id]` (DRAFT only)

### 10.2 Posting validation (payments)
- On POST action, server enforces:
  - payment must be `APPROVED`
  - allocations can reference only `POSTED` bills
  - allocations cannot overpay a bill (considers already `POSTED` payments)

### 10.3 Approvals policy (interim)
For Phase 1, Vendor Bills/Payments reuse the existing **expense** approval matrix via `canUserApprove(module=\"expense\")`.
This keeps approvals role-assignable without schema changes to the approvals engine yet.

### 10.4 UI pages added (Procurement)
- `/procurement/vendor-bills` (list + create/edit + lifecycle actions)
- `/procurement/vendor-payments` (list + create/edit + allocations + lifecycle actions)

---

## 11) Phase 1 (M1) — Posting traceability + default warehouse (InventoryLedger)

Aligned inventory posting creation with SOP non-negotiables by populating posting trace fields and warehouse attribution where we create inventory ledger entries.

### 11.1 Default warehouse selection
All new InventoryLedger postings now assign `warehouseId` using the default warehouse (`Warehouse.isDefault = true`).

### 11.2 Posting trace fields populated
For new InventoryLedger entries created via:
- GRN (Goods Receipts): `sourceType="GRN"`, `sourceId=<receiptId>`, `postedById=<user>`, `postedAt=<receivedDate>`
- Expense -> Inventory stock-in: `sourceType="EXPENSE_INVENTORY"`, `sourceId=<expenseId>`, `postedById=<user>`, `postedAt=now`
- Manual ledger adjustments API: `sourceType="INVENTORY_LEDGER_MANUAL"`, `sourceId=<ledger.id>`, `postedById=<user>`, `postedAt=now`

### 11.3 Code points updated
- `src/app/api/procurement/grn/route.ts` (stock-in postings)
- `src/app/api/procurement/grn/[id]/route.ts` (stock-in postings)
- `src/app/api/expenses/route.ts` (expense-driven stock-in postings)
- `src/app/api/inventory/ledger/route.ts` (manual ledger postings)
- Added helper: `src/lib/warehouses.ts` (`ensureDefaultWarehouseId`)

---

## 12) Phase 1 (E) Reporting — AP Aging (truthful basics)

Added a basic but truthful AP Aging report driven by:
- `VendorBill` (status `POSTED`)
- `VendorPaymentAllocation` joined to `VendorPayment` (status `POSTED`)

### 12.1 UI page
- `src/app/reports/ap/page.tsx`
  - Filters: date range (`billDate`), vendor name contains, overdue-only
  - KPIs: total posted bills, paid, outstanding, overdue outstanding

### 12.2 Export API
- `GET /api/reports/ap/export` (CSV)

---

## 13) CEO Blueprint update (diagrams)

Updated the executive blueprint diagrams to reflect the Phase 1 procurement/AP work that now exists in code:
- Vendor Bills + Vendor Payments
- Company Accounts (Cash/Bank attribution)
- Warehouse (default) + inventory posting traceability
- AP Aging report fed by posted bills + posted payments allocations

### 13.1 Diagram source
- `docs/ERP_DIAGRAMS.md` (rendered at `/ceo/blueprint`)

---

## 14) Phase 1 guardrail — Disabled Expense -> Inventory stock-in (SUPER_MASTER_PLAN)

To close the "hybrid prototype gap" and prevent inventory drift:
- Expenses are now **non-stock only** in Phase 1.
- Stock purchases must be recorded only through the procurement spine:
  - `PO -> GRN -> Vendor Bill -> Vendor Payment`

### 14.1 API hard-block (server-side)
- `POST /api/expenses` rejects any payload attempting stock fields:
  - `addToInventory`, `inventoryItemId`, `inventoryQuantity`, `inventoryUnitCost`
- `PATCH /api/expenses/:id` rejects the same keys.
- Legacy protection:
  - Expenses with `inventoryLedgerId` are treated as **legacy inventory-affecting** and cannot be edited/deleted.

Files:
- `src/app/api/expenses/route.ts`
- `src/app/api/expenses/[id]/route.ts`
- `src/lib/validation.ts` (removed stock fields from the expense schema)

### 14.2 UI removal + clarity
- Removed "Add to Inventory" UI from expense forms.
- Added a visible hint to direct users to Procurement for stock purchases.
- Expense list shows a `LEGACY` badge when `inventoryLedgerId` is present, and actions are disabled for legacy rows.

Files:
- `src/components/ExpenseFormDialog.tsx`
- `src/components/ExpenseForm.tsx`
- `src/app/expenses/page.tsx`
- `src/components/ExpenseActions.tsx`

### 14.3 Staging deploy (Hostinger VPS)
- Deployed `dev` commit: `b2941c0`
- Backup created before deploy actions:
  - `/var/backups/automatrix-erp/automatrix_erp_staging_20260210-183227.dump`
- Migrations:
  - `prisma migrate deploy` found **no pending migrations**

---

## 15) Phase 1 Release Blockers — RB1/RB2/RB4 progress

### 15.1 RB1 — Remove QuickEdit prompt in finance/inventory
- Removed the unused `QuickEditButton` (prompt-based edits) so it cannot reappear in finance/inventory UI.
- File:
  - `src/components/TableActions.tsx`

### 15.2 RB2 — RBAC + data exposure sweep (exports + audit endpoint)
- Protected audit log API with explicit RBAC permission:
  - `GET /api/audit` now requires `audit.view`
  - Files:
    - `src/app/api/audit/route.ts`
    - `src/lib/permissions.ts` (added `audit.view` to Finance/Admin roles)
- Export endpoints are now **audited** (in addition to permission gating):
  - Added `logAudit(...)` calls to CSV export routes to record who exported what.
  - Files (non-exhaustive list of exports updated):
    - `src/app/api/expenses/export/route.ts`
    - `src/app/api/income/export/route.ts`
    - `src/app/api/wallets/export/route.ts`
    - `src/app/api/inventory/ledger/export/route.ts`
    - `src/app/api/reports/*/export/route.ts`
    - `src/app/api/reports/procurement/*-export/route.ts`
    - `src/app/api/me/*/export/route.ts`

### 15.3 RB4 — Restore Playwright e2e (safe-by-default)
- Updated Playwright to run with an **isolated E2E database** by default:
  - Requires `E2E_DATABASE_URL` unless `PLAYWRIGHT_ALLOW_REAL_DB=1` override is explicitly set.
  - File:
    - `playwright.config.ts`
- Added an **E2E-only credentials provider** (guarded by `E2E_TEST_MODE=1`) so Playwright can log in without real Google OAuth.
  - Bootstraps a test Employee + Role + User in the E2E DB when missing (E2E-only).
  - Files:
    - `src/lib/auth.ts`
    - `src/app/login/LoginClient.tsx` (E2E form visible only when `NEXT_PUBLIC_E2E_TEST_MODE=1`)
- Replaced outdated Playwright specs and added RB4 specs:
  - `playwright/tests/rb4-procurement-chain.spec.ts`
  - `playwright/tests/rb4-expenses-nonstock.spec.ts`

### 15.4 Staging deploy (Hostinger VPS)
- Deployed `dev` commit: `1c0d3e8`
- Backup created before deploy actions:
  - `/var/backups/automatrix-erp/automatrix_erp_staging_20260210-191126.dump`
- Migrations:
  - `prisma migrate deploy` found **no pending migrations**

---

## 16) Procurement doc lifecycle hardening (PO + GRN) — Phase 1 single-spine

Aligned Purchase Orders and GRNs with the Phase 1 lifecycle model (no implicit postings, no edits after posting).

### 16.1 GRN (Goods Receipt) lifecycle + explicit inventory posting
- GRN create now defaults to `DRAFT` (no InventoryLedger postings on create).
- New lifecycle actions:
  - `SUBMIT` (DRAFT -> SUBMITTED)
  - `APPROVE` (SUBMITTED -> APPROVED)
  - `POST` (APPROVED -> POSTED) **creates InventoryLedger postings + updates avg cost**
  - `VOID` (non-posted only)
- Editing/deleting GRNs is allowed only while `DRAFT`.

Files:
- `src/app/api/procurement/grn/route.ts`
- `src/app/api/procurement/grn/[id]/route.ts`
- `src/components/GoodsReceiptFormDialog.tsx`
- `src/components/GoodsReceiptActions.tsx`

### 16.2 Purchase Order lifecycle
- PO create now defaults to `DRAFT`.
- New lifecycle actions:
  - `SUBMIT` (DRAFT -> SUBMITTED)
  - `APPROVE` (SUBMITTED -> ORDERED)
  - `CANCEL` (blocked if posted receipts exist)
- Editing/deleting POs is allowed only while `DRAFT`.

Files:
- `src/app/api/procurement/purchase-orders/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/route.ts`
- `src/components/PurchaseOrderFormDialog.tsx`
- `src/components/PurchaseOrderActions.tsx`

### 16.3 Blueprint update
- Updated the flow to show explicit GRN posting to Inventory Ledger (no implicit stock-in on create).
- File:
- `docs/ERP_DIAGRAMS.md`

---

## 17) RB3 Procurement UX polish (Vendor Bills + Payments)

Improved procurement UX to be closer to “ERP standard” while keeping Phase 1 scope lean.

### 17.1 Vendor Bill multi-line editor improvements
- Vendor Bill lines now support item-style entry (optional):
  - `itemId`, `quantity`, `unit`, `unitCost` (server computes line total when qty+unitCost present).
- Service-style lines remain supported:
  - description + manual total (no item).
- Added “Import from GRN” helper:
  - select a GRN and import its items as bill lines (with `grnItemId` linkage).

Files:
- `src/components/VendorBillFormDialog.tsx`
- `src/app/api/procurement/vendor-bills/route.ts`
- `src/app/api/procurement/vendor-bills/[id]/route.ts`

### 17.2 Vendor Payment allocation UX improvements
- Added “Auto allocate” (fills allocations sequentially up to payment amount).
- Added per-bill “Max” button (allocates up to outstanding, respecting payment amount).

File:
- `src/components/VendorPaymentFormDialog.tsx`

---

## 18) Posting traceability for AP allocations (SOP non-negotiable)

Extended `VendorPaymentAllocation` to carry posting trace fields so allocations can be audited as “ledger-like” rows:
- `sourceType`, `sourceId`, `postedById`, `postedAt`

API behavior:
- Allocation rows always stamp `sourceType/sourceId` on create/edit.
- When a payment is POSTED, allocations get `postedById/postedAt`.

Files:
- `prisma/schema.prisma`
- `src/app/api/procurement/vendor-payments/route.ts`
- `src/app/api/procurement/vendor-payments/[id]/route.ts`

---

## 19) CEO Dashboard (Phase 1 truthful KPIs)

Added an executive-only dashboard aligned to `SUPER_MASTER_PLAN.md` reporting list:
- AP outstanding + overdue count (from posted bills + posted allocations)
- Payments this month by CompanyAccount
- Purchases billed this month
- Inventory low stock list
- GRN stock-in activity (from InventoryLedger sourceType=GRN)
- Approval queue counts (from “pending/submitted” docs)
- Exceptions list (blocked actions recorded in AuditLog)

Files:
- `src/app/ceo/dashboard/page.tsx`
- `src/lib/navigation.ts` (adds nav item)
- `docs/ERP_DIAGRAMS.md` (updated blueprint to Phase 1 spine)

---

## 20) CI/CD hardening (GitHub Actions)

Fixed GitHub Actions failures so `dev` can deploy to staging reliably and CI reflects Linux production behavior.

### 20.1 GitHub Actions: pnpm + Node 20.9+
- Deploy workflows updated to use pnpm (`pnpm-lock.yaml`) instead of npm lockfiles.
- Node version bumped to `20.9.0` for Next.js 16.

### 20.2 Vitest CI fix (ERR_REQUIRE_ESM / jsdom)
- Switched Vitest to `environment: node` (current tests are server-side business logic only).
- This avoids jsdom transitive ESM-require failures on GitHub Linux runners.

### 20.3 RB2 tightening (small exposure fixes)
- `/api/payment-modes` now requires expense view permission and scopes results to the user unless they have `expenses.view_all`.
- `/api/income-sources` now requires income view permission and scopes results to the user unless they have `income.view_all`.
- “My exports” routes now require `employees.view_own` (or `employees.view_all`) in addition to auth.

Files:
- `.github/workflows/ci.yaml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `vitest.config.ts`
- `vitest.setup.ts`
- `src/app/api/payment-modes/route.ts`
- `src/app/api/income-sources/route.ts`
- `src/app/api/me/wallet/export/route.ts`
- `src/app/api/me/payroll/export/route.ts`
- `src/app/api/me/incentives/export/route.ts`

---

## 21) Procurement approvals policy module (Phase 1 alignment)

Fixed a policy mismatch: Vendor Bills/Payments were using the **expense** approval policy module.
Phase 1 requires procurement approvals to be independently assignable (role-based) and auditable.

Change:
- Added approval module: `procurement` (code-only; DB model already supports arbitrary `module` strings).
- Default thresholds reuse expense thresholds; default allowed roles:
  - L1: Procurement + finance/executives
  - L2/L3: finance/executives
- Vendor Bill and Vendor Payment approval checks now use `module: "procurement"`.

Files:
- `src/lib/approval-policies.ts`
- `src/app/api/procurement/vendor-bills/[id]/route.ts`
- `src/app/api/procurement/vendor-payments/[id]/route.ts`
