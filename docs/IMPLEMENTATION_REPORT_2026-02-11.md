# Implementation Report — 2026-02-11 (Codex)

**Author / Identity:** Codex (GPT-5), engineering agent for this repo  
**Branch:** `dev`  
**Mode:** Phase 1 single-spine (per `SUPER_MASTER_PLAN.md` + `SOP.md`)

---

## 1) Goal
Lock the Phase 1 single-spine boundary in a way that cannot regress:
- Expenses are **non-stock only** and must never write `InventoryLedger`.
- Procurement chain is the only stock-purchase path (PO -> GRN -> Vendor Bill -> Vendor Payment).
- Add verifiable tests + repo hygiene to keep CI and deployments stable.

---

## 2) What changed (diff summary)

### 2.1 Repo hygiene (non-breaking)
- `.gitignore`
  - Added ignores:
    - `playwright-report/`
    - `__MACOSX/`

### 2.2 Tests (RB4)
- `playwright/tests/rb4-procurement-chain.spec.ts`
  - Added negative E2E test:
    - **Expense stock-in attempt must be rejected** (server-side).

### 2.3 Testing docs
- `docs/testing.md`
  - How to run:
    - `pnpm test` (Vitest unit tests)
    - `pnpm test:e2e:prod` (Playwright prod-like, requires `E2E_DATABASE_URL`)

### 2.4 Plan status note
- `SUPER_MASTER_PLAN.md`
  - Updated cleanup “Status” notes:
    - `Credentials.md` removed from repo.
    - `.gitignore` guardrails explicitly noted.

---

## 3) Evidence (where the spine boundary is enforced)

### 3.1 Expenses cannot do stock purchases (API hard-block + audit)
- `src/app/api/expenses/route.ts:14` defines blocked stock keys.
- `src/app/api/expenses/route.ts:144` blocks stock payload keys in POST and writes an audit log entry action:
  - `BLOCK_EXPENSE_STOCK_PAYLOAD`
- `src/app/api/expenses/[id]/route.ts:30` blocks edits to legacy expenses that already affected inventory.
- `src/app/api/expenses/[id]/route.ts:52` blocks stock payload keys in PATCH and writes audit action:
  - `BLOCK_EXPENSE_STOCK_PAYLOAD`

### 3.2 E2E guardrail exists (so it can’t silently regress)
- `playwright/tests/rb4-procurement-chain.spec.ts:196` asserts expense stock-in attempt returns `400` with the Phase 1 error message.

### 3.3 Blueprint updated
- `docs/ERP_DIAGRAMS.md:1` reflects Phase 1 spine + the explicit “Expenses cannot post stock” guardrail.

---

## 4) GitHub Actions / CI status (what was failing + current state)

### 4.1 Next.js Node requirement
Your Next.js version requires Node `>=20.9.0`. CI and deploy workflows must use Node 20+.
- `ci.yaml` uses Node 20 (`.github/workflows/ci.yaml:38`).
- Deploy workflows use Node `20.9.0` (`.github/workflows/deploy-staging.yml:22`, `.github/workflows/deploy-production.yml:22`).

### 4.2 pnpm lockfile error (“Dependencies lock file is not found…”)
That error happens when `actions/setup-node` is caching **npm/yarn** instead of pnpm (it searches for `package-lock.json`/`yarn.lock`).
Current workflows are configured to cache pnpm:
- `.github/workflows/ci.yaml:41` `cache: 'pnpm'`
- `.github/workflows/deploy-staging.yml:25` `cache: 'pnpm'`
- `.github/workflows/deploy-production.yml:25` `cache: 'pnpm'`
and the repo contains `pnpm-lock.yaml` at the root.

### 4.3 Vitest jsdom ESM crash in CI (previous)
Unit tests now run in `node` environment (no jsdom) to avoid transitive ESM require failures:
- `vitest.config.ts:16` `environment: 'node'`

---

## 5) Verification (what I ran locally)
```bash
pnpm lint
pnpm typecheck
pnpm test
```

E2E (production-like) requires a dedicated throwaway Postgres DB:
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod
```

CI runs the E2E chain against a disposable Postgres service:
- `.github/workflows/ci.yaml:12`

---

## 6) Deploy status (staging)
Staging is running and healthy (example check that was executed by you):
```bash
ssh hostinger-vps 'cd /var/www/automatrix-erp-staging && git log -1 --oneline && pm2 status automatrix-erp-staging && curl -sSf http://127.0.0.1:3031/api/health'
```

---

## 7) What remains to “complete” Phase 1 (single-spine) per SUPER_MASTER_PLAN.md

Release-blockers (still pending):
1. CEO dashboard KPIs (truth-source + drilldown only; no “fake aggregates”)
2. Phase 1 reports pack (AP aging, inventory on-hand/value, GRN activity, approvals queue, exceptions)
3. Posting immutability: ensure all POSTED docs reject value-bearing edits server-side + audit

