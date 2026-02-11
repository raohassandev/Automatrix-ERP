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

