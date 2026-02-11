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

## Seeding test role users (dev/staging only)

Optional seed path (explicit, never implicit):
```bash
export SEED_TEST_USERS=1
pnpm prisma:seed
```

Notes:
- The seed is guarded and only runs when `SEED_TEST_USERS=1` and the environment is dev/staging.
- In E2E mode, Playwright login can also bootstrap these users automatically via the E2E Credentials provider.
