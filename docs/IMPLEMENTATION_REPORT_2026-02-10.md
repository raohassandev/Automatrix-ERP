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

