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

## Vendor + Item Work Hub E2E (RBAC + API-negative + mobile)

Covers:
- Vendor Detail Work Hub actions (`/vendors/[id]`)
- Item Detail Work Hub actions (`/inventory/items/[id]`)
- API-negative permission checks for finance-only/procurement-only actions
- Mobile smoke (iPhone 13): actions menus open

Run:
```bash
pnpm test:e2e:prod -- vendor-item-workhub-actions
```

## Seeding test role users (dev/staging only)

Optional seed path (explicit, never implicit):
```bash
export SEED_TEST_USERS=1
pnpm prisma:seed
```

Notes:
- The seed is guarded and only runs when `SEED_TEST_USERS=1` and the environment is dev/staging.
- In E2E mode, Playwright login can also bootstrap these users automatically via the E2E Credentials provider.
