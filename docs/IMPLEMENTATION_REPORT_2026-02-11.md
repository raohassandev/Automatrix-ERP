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

Previous Phase 1 release-blockers (now completed in section 8):
1. CEO dashboard KPIs + drilldowns (truth sources only)
2. Phase 1 reports pack (AP aging, inventory on-hand/value, GRN activity, approvals queue, exceptions)
3. Posting immutability (server-side) + audit for blocked edits

Remaining work (polish / follow-ups):
- Expand Playwright E2E coverage beyond RB4 (future), and add more negative cases as new invariants are introduced.
- Continue reducing/remove Legacy pages that expose prototype metrics without a clear Legacy label.

---

## 8) Update — Phase 1 completion pass (Dashboards + Reports + Immutability)

### 8.1 POSTED immutability enforcement (blocked edits are audited)
Added audit entries when users attempt field edits in non-DRAFT status:
- `src/app/api/procurement/purchase-orders/[id]/route.ts`
- `src/app/api/procurement/grn/[id]/route.ts`
- `src/app/api/procurement/vendor-bills/[id]/route.ts`
- `src/app/api/procurement/vendor-payments/[id]/route.ts`

Audit action used: `BLOCK_EDIT_NON_DRAFT`

### 8.2 Procurement report aligned to single-spine (no Expenses proxy)
Procurement report now shows **only stock-in truth** from `InventoryLedger` (GRN postings):
- `src/app/reports/procurement/page.tsx`
- `src/app/api/reports/procurement/export/route.ts` now supports only `type=ledger` / `type=stockin` and rejects expense exports.

### 8.3 CEO dashboard approval queue aligned to Phase 1 scope
Removed Income/Expense approval queue counts from CEO dashboard (Phase 1 focuses on procurement spine):
- `src/app/ceo/dashboard/page.tsx`

### 8.4 /dashboard made Phase-1 safe (no prototype “profit” metrics)
Dashboard is now navigation-first and links to truthful KPI surfaces:
- `src/app/dashboard/page.tsx`

### 8.5 Reports landing page aligned to Phase 1 truth sources
Reports overview now highlights Phase 1 spine reports and clearly labels non-spine reports as Legacy:
- `src/app/reports/page.tsx`

### 8.6 Verification run
```bash
pnpm lint
pnpm typecheck
pnpm test
```

---

## 9) Detail Pages Pattern (Phase 1) — Project Detail (RBAC + mobile)

### 9.1 Route + navigation
- New route: `/projects/[id]`
  - `src/app/projects/[id]/page.tsx`
- Project list rows are now clickable and navigate to the detail page:
  - `src/components/ProjectsTable.tsx`
  - Mobile cards now render the title as a link:
    - `src/components/MobileCard.tsx`

### 9.2 Data truth sources (Phase 1 spine)
Project detail is read-first and truth-sourced from:
- Procurement docs: PO/GRN/VendorBill/VendorPayment (filtered by `projectRef`)
- Inventory movements: `InventoryLedger` (filtered by `project`)
- Expenses: shown only as **non-stock costs** (never as inventory movements)

Implementation:
- `src/lib/project-detail-policy.ts`
- `src/app/api/projects/[id]/detail/route.ts`

### 9.3 RBAC + masking (enforced twice: server + UI)
Enforcement points:
- Server/API: `/api/projects/[id]/detail` returns role-filtered data.
- UI: tabs and fields render only what policy allows (no client-only hiding).

Policy matrix (Phase 1 default):
- Finance/Owner (Finance Manager/Admin/CFO/CEO/Owner):
  - Tabs: Activity, Costs, Inventory, People, Documents
  - Fields: unitCost + totals visible
- Engineer/PM (Engineering):
  - Tabs: Activity, Inventory, People, Documents
  - Fields: unitCost + totals masked
- Sales/Marketing (Sales/Marketing):
  - Tabs: Activity, Documents (docs-only view)
  - Fields: no costs, no inventory, no people
- Technician (Staff):
  - Tabs: Activity, Inventory, Documents
  - Fields: unitCost + totals masked (qty only)
- Store (Store Keeper):
  - Tabs: Activity, Inventory, Documents
  - Fields: unitCost + totals masked (qty/movements only)

### 9.4 Test users strategy (dev/staging only)
- Seed option (explicit):
  - `prisma/seed.js` supports `SEED_TEST_USERS=1` (guarded to dev/staging)
- E2E login role mapping:
  - `src/lib/auth.ts` maps specific emails to role names in `E2E_TEST_MODE`
- Store Keeper permission adjusted to allow assigned project access:
  - `src/lib/permissions.ts`

### 9.5 Playwright E2E (RBAC + mobile)
- Added: `playwright/tests/project-detail-rbac.spec.ts`
  - Logs in as 5 roles, asserts:
    - allowed tabs visible; disallowed tabs hidden
    - sensitive fields masked/absent where required
  - Mobile test (iPhone 13):
    - `/projects` click -> `/projects/[id]`
    - tabs dropdown works

Run (requires disposable DB):
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- project-detail-rbac
```
