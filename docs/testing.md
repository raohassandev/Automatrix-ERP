# Testing (Phase 1)

This repo uses:
- Unit tests: Vitest (server-side/business logic)
- E2E tests: Playwright (RB4 procurement chain; runs against a disposable Postgres DB)

## Unit tests

Run:
```bash
pnpm test
```

## E2E (Playwright) — safe by default

The production-like Playwright config requires `E2E_DATABASE_URL` so tests do not accidentally run against a real DB.

### Run E2E (production-like config)
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
export NEXTAUTH_URL='http://localhost:3000'
export AUTH_SECRET='dev-secret'
export GOOGLE_CLIENT_ID='dummy'
export GOOGLE_CLIENT_SECRET='dummy'

pnpm test:e2e:prod
```

Optional (if using the E2E credentials flow):
```bash
export E2E_TEST_EMAIL='e2e-admin@automatrix.local'
export E2E_TEST_PASSWORD='e2e'
```

### What E2E covers (Phase 1 spine)
- RB4: PO -> GRN -> Vendor Bill -> Vendor Payment (posted) + inventory ledger stock-in
- Negative: expense stock-in payload must be rejected (Expenses are non-stock only in Phase 1)

## E2E — Project Detail (RBAC + mobile)

This repo also includes role-based E2E coverage for `/projects/[id]`:
- Tab visibility assertions per role
- Sensitive field masking (unit costs / totals)
- Mobile (iPhone 13) navigation + tabs dropdown

Run:
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- project-detail-rbac
```

## Vendor Detail RBAC E2E

Run:
```bash
pnpm test:e2e:prod -- vendor-detail-rbac
```

Required env vars / safety guardrails:
- You MUST use a disposable DB:
  - `E2E_DATABASE_URL` must point to a throwaway Postgres database (never staging/prod).
- If `E2E_TEST_MODE` is used:
  - It is guarded by `src/lib/auth-e2e-guard.ts` and cannot run when `NEXTAUTH_URL` contains:
    - `erp.automatrix.pk` (prod) or `erp-staging.automatrix.pk` (staging)
  - E2E mode is only allowed for localhost URLs.

Expected outcomes:
- Finance sees `Bills`, `Payments`, and `Aging` tabs.
- Sales / Store / Engineer do not see financial amounts or restricted tabs.

## Item Detail + My Portal E2E (RBAC + mobile)

Covers:
- Inventory Item Detail: `/inventory/items/[id]` (RBAC + server-side masking + mobile)
- My Portal: `/me` (self-only view) and access checks for `/employees/[id]`

Run:
```bash
pnpm test:e2e:prod -- item-detail-and-me-portal
```

Expected outcomes:
- Finance sees item ledger costs (unitCost/total/value); Store does not.
- Sales sees availability-only (On-hand tab only).
- Store cannot open `/employees/[id]` (forbidden).

## Project + Vendor + Item Work Hub + Employee Access E2E (RBAC + API-negative + mobile)

Covers:
- Project Detail Work Hub actions (`/projects/[id]`)
- Vendor Detail Work Hub actions (`/vendors/[id]`)
- Item Detail Work Hub actions (`/inventory/items/[id]`)
- Company Account Detail Work Hub (`/company-accounts/[id]`) (finance-only)
- Employee access checks:
  - `/me` loads for all roles
  - `/employees/[id]` blocked for non-HR/non-Finance roles
- API-negative permission checks for finance-only/procurement-only actions
- Mobile smoke (iPhone 13): actions menus open

Run:
```bash
pnpm test:e2e:prod -- vendor-item-workhub-actions
```

Expected outcomes:
- Finance sees procurement + assignment actions on Project and payment action on Vendor.
- Engineer/Store do not see finance-only actions (payments/assignments/PO create where not allowed).
- Company Account Detail is finance-only; restricted roles see a forbidden UI and the detail API returns 403.

## Seeding test role users (dev/staging only)

Optional seed path (explicit, never implicit):
```bash
export SEED_TEST_USERS=1
pnpm prisma:seed
```

Notes:
- The seed is guarded and only runs when `SEED_TEST_USERS=1` and the environment is dev/staging.
- In E2E mode, Playwright login can also bootstrap these users automatically via the E2E Credentials provider.

## Staging role testing (temporary credentials mode)

For staging-only QA runs (manual + Playwright role checks), credentials login can be enabled temporarily:

```bash
AUTH_ENABLE_CREDENTIALS=1
NEXT_PUBLIC_ENABLE_CREDENTIALS_LOGIN=1
```

Rules:
- Staging only; never enable this on production.
- Keep allowlist policy enforced (only ACTIVE employees can sign in).
- Disable/remove credentials mode after QA stabilization and before production hardening signoff.

## Staging batch gate (recommended to reduce deploy cycles)

Use these before pushing to `dev` so fixes are bundled and deployment runs once per stable batch.

Critical staging gate:
```bash
pnpm test:staging:critical
```

Critical staging gate (faster parallel mode for long-pass local batches):
```bash
pnpm test:staging:critical:fast
```

Effective-permission parity verification (all active users):
```bash
pnpm verify:staging:effective-permissions
```

One-command long-pass batch gate:
```bash
pnpm qa:staging:batch
```

Full staging regression:
```bash
pnpm test:staging:full
```

Recommended cadence:
1. Implement 4-8 related fixes locally.
2. Run `pnpm typecheck` and `pnpm lint` on touched files.
3. Run `pnpm test:staging:critical:fast` during active development, then `pnpm test:staging:critical` before final push.
4. Push once.
5. Run `pnpm test:staging:full` only for release-candidate batches.
