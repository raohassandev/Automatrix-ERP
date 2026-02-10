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
