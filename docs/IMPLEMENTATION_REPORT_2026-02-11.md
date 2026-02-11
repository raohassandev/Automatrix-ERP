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

---

## Vendor Detail (RBAC + mobile)

### Route + navigation
- New route: `/vendors/[id]`
  - `src/app/vendors/[id]/page.tsx`
- Vendor list now links vendor names to the detail page (desktop + mobile):
  - `src/app/vendors/page.tsx`

### Truth sources (Phase 1 spine)
Vendor detail is read-first and truth-sourced from Phase 1 procurement/AP spine:
- Vendor AP:
  - `VendorBill` (and totals when permitted)
  - `VendorPayment` + allocations (when permitted)
- Procurement docs:
  - `PurchaseOrder`, `GoodsReceipt`
- Activity feed:
  - Built from procurement/AP docs (no Expenses proxy)

Implementation:
- `src/lib/vendor-detail-policy.ts`
- `src/app/api/vendors/[id]/detail/route.ts`

### RBAC + masking (enforced twice: server + UI)
Enforcement points:
- Server/API: `/api/vendors/[id]/detail` returns role-filtered data and omits sensitive fields for restricted roles.
- UI: tabs and fields render only what policy allows (no client-only hiding).

API behavior (server-side masking):
- API: `GET /api/vendors/[id]/detail` (role-filtered payload; masking enforced server-side)
- For restricted roles (Sales/Store/Engineer/Technician), the API omits VendorBill/VendorPayment datasets entirely and never returns financial fields such as:
  - `totalAmount`, `paidAmount`, `allocatedAmount`, `aging*`, `unitCost`

Important note (current permission mapping):
- Vendor financial amount visibility is currently controlled by `inventory.view_cost`.
  - TODO: rename to a finance/AP permission (e.g., `ap.view_amounts`) to avoid semantic confusion.

RBAC matrix (Phase 1 default):
- Finance/Owner (Finance Manager/Admin/CFO/CEO/Owner):
  - Tabs: Activity, Bills, Payments, Aging, Documents
  - Fields: bill totals, payment amounts, allocation totals, aging totals visible
- Procurement:
  - Tabs: Activity, Bills, Payments, Aging, Documents
  - Fields: amounts visible only if permission allows (currently `inventory.view_cost`)
- Sales/Marketing:
  - Tabs: Activity, Documents (PO/GRN only)
  - Fields: no bills/payments/aging; no amount fields
- Store/Technician:
  - Tabs: Activity, Documents (PO/GRN only)
  - Fields: no bills/payments/aging; no amount fields
- Engineer/PM:
  - Tabs: Activity, Documents (PO/GRN only, scope via assigned projects)
  - Fields: no bills/payments/aging; no amount fields

### Playwright E2E tests
- Added: `playwright/tests/vendor-detail-rbac.spec.ts`
  - Creates a vendor + minimal AP chain (bill + payment allocation) using finance role.
  - Asserts per-role tab visibility and masking.
  - Mobile test (iPhone 13): `/vendors` -> `/vendors/[id]` and tabs dropdown works.
  - Includes an API-negative assertion to ensure restricted role responses do not include forbidden fields.

Run (requires disposable DB):
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- vendor-detail-rbac
```

### Verification commands
```bash
pnpm lint
pnpm typecheck
pnpm test
```

---

## Item Detail (RBAC + mobile) — Inventory truth hub

### Route + navigation
- New route: `/inventory/items/[id]`
  - `src/app/inventory/items/[id]/page.tsx`
- Inventory list now links item names to item detail (desktop + mobile):
  - `src/components/InventoryTable.tsx`

### Truth sources (Phase 1 spine)
Item detail is truth-sourced from:
- `InventoryItem` (header + availability)
- `InventoryLedger` (activity + ledger + on-hand by warehouse)
- Links to procurement documents are best-effort via ledger `reference` (no prompt-based edits)

Implementation:
- `src/lib/item-detail-policy.ts`
- `src/app/api/inventory/items/[id]/detail/route.ts`

### RBAC + masking (enforced twice: server + UI)
Enforcement points:
- Server/API: `GET /api/inventory/items/[id]/detail` uses role-aware select projections (omits `unitCost`/`total` for restricted roles).
- UI: tab visibility and cost columns follow policy (no UI-only hiding).

RBAC matrix (Phase 1 default):
- Finance/Owner/Procurement (roles with `inventory.view_cost`):
  - Tabs: Activity, Ledger, On-hand, Documents
  - Fields: unitCost + totals/value visible
- Store/Technician/Engineer:
  - Tabs: Activity, Ledger, On-hand, Documents
  - Fields: unitCost + totals/value omitted from API response and absent in UI
- Sales/Marketing:
  - Tabs: On-hand only (availability view)
  - Fields: no unitCost/totals/value

Scope note:
- Engineering ledger/activity is scoped to assigned projects when `InventoryLedger.project` is present (plus non-project entries).

### Playwright E2E tests
- Added: `playwright/tests/item-detail-and-me-portal.spec.ts`
  - Asserts finance vs store vs sales tab/field visibility on item detail
  - Includes API-negative assertion: store response must not contain `unitCost`/`total`
  - Mobile test (iPhone 13): inventory list -> item detail and tabs dropdown works

Run (requires disposable DB):
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- item-detail-and-me-portal
```

### Verification commands
```bash
pnpm lint
pnpm typecheck
pnpm test
```

---

## Employee Access (My Portal + Employee Detail)

### My Portal (`/me`)
- Existing route enhanced to include assigned projects list (clickable to `/projects/[id]`):
  - `src/app/me/page.tsx`
- Self-only behavior:
  - Uses the signed-in user + linked employee record (by email)
  - Does not show other employees’ data

### Employee Detail (`/employees/[id]`)
- New route: `/employees/[id]` (HR/Finance/Admin only)
  - `src/app/employees/[id]/page.tsx`
- Access rules:
  - Page requires `employees.view_all` (server-protected)
  - PII fields (CNIC/address/education/experience) are permission-gated to HR/Finance/Admin-style roles

### Playwright E2E coverage
- Covered in: `playwright/tests/item-detail-and-me-portal.spec.ts`
  - Each role can load `/me`
  - Store role cannot access `/employees/[id]` (forbidden)

## Hardening Pass: E2E auth guard + Project RBAC parity + Audit gating

### What changed (minimal, security-only)
- Locked down E2E auth mode so it cannot be enabled on staging/prod by env accident.
- Tightened Project Detail API masking by using role-aware select projections (avoid “fetch then strip”).
- Confirmed `/api/audit` is permission-gated and export endpoints are permission-gated + audited.

### Files changed
- `src/lib/auth.ts`
- `src/lib/auth-e2e-guard.ts`
- `src/lib/__tests__/auth-e2e-guard.test.ts`
- `src/lib/project-detail-policy.ts`

### Verification
```bash
pnpm lint
pnpm typecheck
pnpm test
```

---

## Project Detail Work Hub + Sidebar Organization (Phase 1)

### Project Work Hub actions (safe Phase 1 routing)
Project Detail (`/projects/[id]`) remains read-first, but now includes an `Actions` menu (permission-gated + audited).

Actions implemented (Phase 1 safe):
- Create Purchase Order for this Project (opens PO create dialog with `projectRef` prefilled)
- Receive Goods (GRN) for this Project (opens GRN create dialog with `projectRef` prefilled)
- Create Vendor Bill for this Project (opens Vendor Bill create dialog with `projectRef` prefilled)
- Assign People to Project (writes audited add/remove events)
- Add Project Note (audited event; no new Note table in Phase 1)
- Add Attachment (URL-only; creates `Attachment` + audit log)

Explicitly not added:
- No “add inventory item” from Project page (inventory truth remains GRN/ledger only)
- No edits to posted financial docs
- No prompt-based edits

Implementation files:
- UI:
  - `src/app/projects/[id]/ProjectDetailClient.tsx`
- Policy (UI + API agreement):
  - `src/lib/project-workhub-policy.ts`
- APIs (server-enforced + audited):
  - `src/app/api/projects/[id]/assignments/route.ts` (adds `PROJECT_MEMBER_ADD` / `PROJECT_MEMBER_REMOVE`)
  - `src/app/api/projects/[id]/notes/route.ts` (`PROJECT_NOTE_ADD`)
  - `src/app/api/projects/[id]/attachments/route.ts` (`PROJECT_ATTACHMENT_ADD`)

Default role matrix (Phase 1):
- Finance/Owner: all actions
- Procurement: procurement actions + notes/attachments + assign people if `projects.assign`
- Engineer/PM: notes/attachments only (assign people only if `projects.assign`)
- Store/Technician: notes/attachments only
- Sales/Marketing: notes/attachments only

### Sidebar / navigation organization (Phase 1)
Sidebar is now grouped for Phase 1 clarity and hides legacy/out-of-scope modules by default (pages remain accessible by URL).
- Groups: Operations, Finance, People, Controls, Reports, Directory

Implementation:
- `src/lib/navigation.ts`

### Playwright E2E (RBAC + mobile)
- Added: `playwright/tests/project-workhub-actions.spec.ts`
  - Asserts action visibility by role (Finance vs Engineer vs Store)
  - API-negative: Store cannot call project assignments (403)
  - Mobile smoke (iPhone 13): Actions menu opens

Run (requires disposable DB):
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- project-workhub-actions
```

---

## Vendor + Item Work Hub (Phase 1)

### Vendor Detail Work Hub (`/vendors/[id]`)
Added an `Actions` menu to Vendor Detail to start Phase 1 document flows (no ad-hoc finance logic) and to add safe notes/attachments.

Actions (Phase 1 safe):
- Create PO for this Vendor (opens PO create dialog with vendor prefilled)
- Create Vendor Bill for this Vendor (opens Vendor Bill create dialog with vendor prefilled)
- Record Vendor Payment (Finance/Owner only)
- Add Vendor Note (audited)
- Add Vendor Attachment (URL-only, audited)

Server APIs (RBAC enforced server-side):
- `POST /api/vendors/[id]/notes` -> audit: `VENDOR_NOTE_ADD`
- `POST /api/vendors/[id]/attachments` -> create `Attachment(type=vendor)` + audit: `VENDOR_ATTACHMENT_ADD`

RBAC matrix (default):
- Finance/Owner: all actions
- Procurement: PO/Bill + note/attachment (no Payment unless finance role)
- Sales/Marketing/Engineer/Store/Technician: note/attachment only

Implementation:
- UI: `src/app/vendors/[id]/VendorDetailClient.tsx`
- Policy: `src/lib/vendor-workhub-policy.ts`
- APIs: `src/app/api/vendors/[id]/notes/route.ts`, `src/app/api/vendors/[id]/attachments/route.ts`

### Item Detail Work Hub (`/inventory/items/[id]`)
Added an `Actions` menu to Item Detail for Phase 1 safe actions.

Actions (Phase 1 safe):
- Start Purchase Order with this Item (Procurement/Finance only; prefilled as the first line item)
- Add Item Note (audited)
- Add Item Attachment (URL-only, audited)

Server APIs (RBAC enforced server-side):
- `POST /api/inventory/items/[id]/notes` -> audit: `ITEM_NOTE_ADD`
- `POST /api/inventory/items/[id]/attachments` -> create `Attachment(type=inventory_item)` + audit: `ITEM_ATTACHMENT_ADD`

RBAC matrix (default):
- Procurement/Finance: all actions
- Store/Technician/Engineer/Sales: note/attachment only (no PO action)

Implementation:
- UI: `src/app/inventory/items/[id]/ItemDetailClient.tsx`
- Policy: `src/lib/item-workhub-policy.ts`
- APIs: `src/app/api/inventory/items/[id]/notes/route.ts`, `src/app/api/inventory/items/[id]/attachments/route.ts`

### Playwright E2E (RBAC + API-negative + mobile)
- Added: `playwright/tests/vendor-item-workhub-actions.spec.ts`
  - Vendor: finance sees Payment action; engineer/store do not
  - Item: finance sees Start PO action; store does not
  - API-negative: sales cannot create vendor payment (403); store cannot create PO (403)
  - Mobile smoke (iPhone 13): Vendor + Item actions menus open

Run (requires disposable DB):
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- vendor-item-workhub-actions
```

## Work Hub Consistency + Notes History (Phase 1)

### Nav parity fix (sidebar matches server RBAC)
Updated sidebar permissions so users don't see "Vendor Payments" unless they have finance/AP permission (`company_accounts.manage`). This prevents "click then 403" for non-finance roles.

Implementation:
- Nav config: `src/lib/navigation.ts` (Vendor Payments now requires `company_accounts.manage`)

### Vendor Payments RBAC tightening (finance/AP only)
Aligned the Vendor Work Hub "Record Vendor Payment" action and vendor payment mutation APIs to require finance/AP permission (`company_accounts.manage`) instead of `procurement.edit`.

Implementation:
- Policy: `src/lib/vendor-workhub-policy.ts` (payment action now requires `company_accounts.manage`)
- APIs:
  - `src/app/api/procurement/vendor-payments/route.ts` (GET/POST require `company_accounts.manage`)
  - `src/app/api/procurement/vendor-payments/[id]/route.ts` (GET/PATCH/DELETE require `company_accounts.manage`)

Verification:
- Playwright: sales cannot create a vendor payment (403)
- Unit gates: `pnpm lint && pnpm typecheck && pnpm test`

### Notes & Attachments History (audit-sourced, Phase 1)
Notes are stored as audited events (no separate Notes table in Phase 1). Added a "Notes & Attachments" section on Project/Vendor/Item detail pages that shows the last 20 audited note/attachment events for that entity.

Truth source:
- `AuditLog` rows filtered by `(entity, entityId, action)`:
  - Project: `PROJECT_NOTE_ADD`, `PROJECT_ATTACHMENT_ADD`
  - Vendor: `VENDOR_NOTE_ADD`, `VENDOR_ATTACHMENT_ADD`
  - InventoryItem: `ITEM_NOTE_ADD`, `ITEM_ATTACHMENT_ADD`

Implementation:
- Data (server-side):
  - `src/lib/project-detail-policy.ts` (adds `notesHistory`)
  - `src/lib/vendor-detail-policy.ts` (adds `notesHistory`)
  - `src/lib/item-detail-policy.ts` (adds `notesHistory`)
- UI:
  - `src/app/projects/[id]/ProjectDetailClient.tsx`
  - `src/app/vendors/[id]/VendorDetailClient.tsx`
  - `src/app/inventory/items/[id]/ItemDetailClient.tsx`

### Playwright E2E consolidated coverage
Extended the existing Work Hub E2E spec to cover Project actions and employee access checks in the same spec (keeps QA cost low and validates RBAC user journeys end-to-end).

Updated spec:
- `playwright/tests/vendor-item-workhub-actions.spec.ts`
  - Project actions RBAC + API-negative for assignments
  - Vendor actions RBAC + API-negative for vendor payments
  - Item actions RBAC + API-negative for PO create
  - `/me` loads for roles; `/employees/[id]` blocked for non-HR/non-Finance
  - iPhone 13 smoke: actions menus open on Project/Vendor/Item

Run (requires disposable DB):
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- vendor-item-workhub-actions
```

## Company Account Detail Work Hub (finance-lite, Phase 1)

### Routes + navigation
- List: `/company-accounts` (finance-only)
- Detail: `/company-accounts/[id]` (finance-only)

### API (RBAC enforced server-side)
- Detail: `GET /api/company-accounts/[id]/detail` (requires `company_accounts.manage`)
- Work Hub actions:
  - `POST /api/company-accounts/[id]/notes` -> audit: `COMPANY_ACCOUNT_NOTE_ADD`
  - `POST /api/company-accounts/[id]/attachments` -> creates `Attachment(type=company_account)` + audit: `COMPANY_ACCOUNT_ATTACHMENT_ADD`

### Truth sources (Phase 1, no GL)
- Account header from `CompanyAccount`
- Current balance is **outflow-only**:
  - `openingBalance - sum(POSTED VendorPayment.amount)` (no inflow/GL in Phase 1)
- Payments tab from `VendorPayment` filtered by `companyAccountId`
- Documents tab from current page payments + their allocated `VendorBill` references
- Notes/attachments history from `AuditLog` (entity=`CompanyAccount`, entityId, actions above)

### Work Hub actions (finance-only)
- Record Vendor Payment (opens existing Vendor Payment dialog prefilled with `companyAccountId`)
- Add Account Note (audit-only note event)
- Add Account Attachment URL (URL-only attachment)

Implementation:
- Detail policy + payload shaping: `src/lib/company-account-detail-policy.ts`
- UI:
  - `src/app/company-accounts/page.tsx`
  - `src/app/company-accounts/[id]/page.tsx`
  - `src/app/company-accounts/[id]/CompanyAccountDetailClient.tsx`
- Vendor Payment dialog prefill:
  - `src/components/VendorPaymentFormDialog.tsx` (`initialCompanyAccountId`)

### Playwright E2E (added to consolidated spec)
Updated:
- `playwright/tests/vendor-item-workhub-actions.spec.ts`
  - Finance can open Company Account detail and see Actions
  - Restricted roles get forbidden UI
  - API-negative: restricted role GET detail returns 403
  - Mobile smoke (iPhone 13): Actions menu opens + tabs dropdown exists

Run:
```bash
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- vendor-item-workhub-actions
```

## Loading UX (Phase 1 hubs + navigation)

### Global navigation indicator
Added a slim top loading strip that appears immediately on internal link navigation (sidebar links + row links) so users can tell the app is working during route transitions.

Implementation:
- `src/components/RouteLoadingIndicator.tsx` (document-level internal link click detection; hides on route change)
- `src/app/layout.tsx` (mounted globally)

### Page-level loading skeleton (App Router)
Added a global `loading.tsx` fallback to avoid blank screens during server navigation.

Implementation:
- `src/app/loading.tsx` (simple, mobile-safe skeleton)

### Action-level loaders + refresh
Standardized action feedback for Work Hub note/attachment/assignment actions:
- Disable submit button + show “Saving…”
- Toast feedback via a shared helper
- Refresh the page (`router.refresh()`) after success so Notes/History updates without manual reload

Implementation:
- Helper: `src/lib/withLoadingToast.ts`
- Updated hubs:
  - `src/app/projects/[id]/ProjectDetailClient.tsx` (assignments + note + attachment)
  - `src/app/vendors/[id]/VendorDetailClient.tsx` (note + attachment)
  - `src/app/inventory/items/[id]/ItemDetailClient.tsx` (note + attachment)
  - `src/app/company-accounts/[id]/CompanyAccountDetailClient.tsx` (note + attachment)

### Playwright UX assertion (cheap + stable)
Extended the consolidated mobile smoke test to assert a loader indicator appears on `list -> detail` navigation on iPhone viewport.

Implementation:
- `playwright/tests/vendor-item-workhub-actions.spec.ts` (expects `route-loading-indicator` or `app-loading-skeleton`)

Verification:
```bash
pnpm lint
pnpm typecheck
pnpm test
# E2E (disposable DB)
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/automatrix_erp_e2e?schema=public'
pnpm test:e2e:prod -- vendor-item-workhub-actions
```
