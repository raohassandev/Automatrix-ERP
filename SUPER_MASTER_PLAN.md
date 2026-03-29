# SUPER MASTER PLAN — AutoMatrix ERP (Phase 1 → Production Ready)

**Product:** AutoMatrix ERP
**Goal:** Convert current hybrid/prototype into a **single-spine ERP**: consistent documents + postings + approvals + auditability + reliable UI + tests + ops discipline.
**Core Principle:** *No ad-hoc fixes.* Everything is implemented as a planned unit: **schema → API → UI → validation → RBAC → audit → reports → tests → ops notes**.

---

## 0) CLEANUP FIRST (Repo Hygiene & Risk Removal) — MUST DO BEFORE NEW WORK

These items are **useless/obsolete** or actively harmful (secrets, binaries, Mac artifacts, build cache). Remove them and update `.gitignore`.

### 0.1 Remove from repo (delete files/folders)

**Secrets / local env (must not be committed):**

- `.env`
- `.env.local`

**Database binaries / dumps (never commit real DB files):**

- `automatrix_erp_staging.dump`
- `prisma/dev.db`
- `prisma/prisma/dev.db`
- `prisma/prisma/prisma/dev.db`

**Mac / system junk:**

- `__MACOSX/`
- `prisma/.DS_Store`
- any `.DS_Store` under repo

**Build/cache artifacts:**

- `tsconfig.tsbuildinfo`
- `test-results/` (Playwright outputs; keep out of git)

**Duplicate / confusing Prisma folder nesting:**

- `prisma/prisma/` (nested prisma folder is redundant; keep a single `prisma/` root only)

### 0.2 Keep, but move to safe places (or clarify)

- `Credentials.md`
  - Either delete or move to a **private password manager reference** (never store secrets in repo).
- `Codebase_Analysis_Report.md`
  - Keep if it’s internal audit evidence; otherwise archive under `docs/archive/`.

### 0.3 `.gitignore` must include

- `.env*` (except `.env.example`)
- `**/*.db`
- `**/*.dump`
- `test-results/`
- `playwright-report/`
- `tsconfig.tsbuildinfo`
- `.DS_Store`
- `__MACOSX/`

**DoD (Cleanup):**

- repo has no secrets / db binaries
- Prisma folder is single and clean
- CI/build reproducibility improves

**Status (current repo):**
- `.env*` and `*.dump` are ignored (not tracked). Keep env files locally only.
- `.gitignore` also ignores `playwright-report/` and `__MACOSX/` to prevent CI/dev artifacts from being committed.
- Nested `prisma/prisma/**` and `*.db` files may exist locally from old experiments; they should be deleted locally, but are not tracked.
- `Codebase_Analysis_Report.md` is archived under `docs/archive/` for long-term reference.
- `Credentials.md` was removed from the repo (secrets must live in a password manager / GitHub secrets only).

---

## 1) NORTH STAR — Single ERP Spine (LOCKED)

Today the codebase is a hybrid:

- Prototype spine: Expenses/Income sometimes touching inventory
- ERP spine: Procurement docs with lines + allocations

**Phase 1 locks ONE spine:**

### 1.1 Source of Truth (LOCKED)

- **Stock truth:** `InventoryLedger` only
- **Money truth (Phase 1):** AR/AP subledger + allocations (NO full GL yet)
- **Posting truth:** only specific documents can create postings.
- **Traceability:** every ledger/allocation row MUST store:
  - `sourceType`, `sourceId`, `postedBy`, `postedAt`

### 1.2 Non-negotiable lifecycle (LOCKED)

All business documents:
`DRAFT → SUBMITTED → APPROVED → POSTED → LOCKED/CANCELLED`

Rules:

- Only `DRAFT` is freely editable.
- After `POSTED`: **no value-bearing edits**. Only reversal/adjustment docs.
- Cancel is allowed only by policy and is fully audited.

---

## 2) PHASE 1 SCOPE (LOCKED)

### 2.1 MUST SHIP Modules (Phase 1)

- **Purchasing (P2P-lite):** Vendor → PO → GRN → Vendor Bill → Vendor Payment (allocations)
- **Inventory:** Item master + Stock Ledger + Adjustments (minimal) + Warehouse (1 default)
- **Approvals + Audit:** enforced for all critical actions
- **Basic Reports:** truthful basics (no “fake KPIs”)

### 2.2 Explicitly OUT (Phase 1)

- Full COA/GL/Journals
- Bank reconciliation
- Tax engine (placeholders only)
- Multi-currency / FX
- HR payroll engine maturity (Phase 3)
- Task mgmt / project mgmt workflows (Phase 4)

---

## 3) LOCKED DEFAULTS (Phase 1)

### 3.1 Currency

- PKR only, no FX.
- Store all money in Decimal.

### 3.2 Timezone & dates

- Business timezone: `Asia/Karachi`
- Every doc stores:
  - `documentDate`
  - `postingDate`
- Back-dating:
  - blocked for normal users
  - allowed for Finance/Owner with reason + audit
- After POSTED: dates cannot change.

### 3.3 Parties model

- Single `Party` master with roles: CUSTOMER / VENDOR / BOTH.

### 3.4 Warehouses + stock reservation

- WarehouseId mandatory in all InventoryLedger rows.
- No reservation in Phase 1. Stock reduces only on Delivery (Phase 1.5 optional).

### 3.5 Company accounts (Phase 1)

- Yes: maintain CompanyAccount list (Cash + Banks).
- Every payment/receipt selects an account (for reporting).

### 3.6 Credit terms (Phase 1)

- Customer terms: Net 30
- Vendor terms: Net 30
- Overdue definition: `today > (invoiceDate + termsDays)`.

### 3.7 Attachments policy (Phase 1)

- URL-only attachments.
- Store metadata: fileName, mimeType, sizeBytes, url.
- Allowed types: pdf/jpg/jpeg/png/xlsx/docx.

### 3.8 Auth policy (Phase 1)

- Google OAuth only.
- No public signup.
- Allowlist via Employee(ACTIVE) or explicit allowed-user table.
- Unknown emails denied (no auto user creation).
- Temporary staging-only QA exception (locked):
  - Credentials login may be enabled on staging for role-by-role Playwright/manual testing.
  - Must stay OFF in production.
  - Must be removed after full QA stabilization cycle and before final production hardening signoff.

---

## 4) DOCUMENT CANON (Phase 1) — The Only Allowed Transaction Paths

### 4.1 Purchasing (Stock + AP)

**Purchase Order (PO)**

- Header: vendor, project (mandatory), dates, status, totals, attachments
- Lines: item, qty, unit cost estimate, projectId (header-only enforced), notes

**Goods Receipt Note (GRN)**

- Can reference PO (partial allowed)
- Posts InventoryLedger:
  - +qty into warehouse
  - avg cost update

**Vendor Bill**

- references GRN or “direct bill”
- multi-line items/services
- creates AP balance (subledger)

**Vendor Payment**

- uses CompanyAccount
- allocates amounts to Vendor Bills
- updates AP balance

### 4.2 Sales (Phase 1 optional if not shipping yet)

(If sales is not shipping Phase 1, mark it OUT clearly.)
If shipping, document chain:
Quotation → Sales Order → Delivery → Sales Invoice → Customer Receipt (allocations)
Stock reduces only on Delivery.

### 4.3 Expenses (STRICT RULE)

**Expenses are non-stock only** in Phase 1:

- Utilities, rent, travel, services, misc
- Expenses MUST NOT create InventoryLedger postings.
- Any existing “expense → inventory stock-in” is deprecated and moved to Legacy mode.

---

## 5) LEGACY STRATEGY (LOCKED)

- Keep existing prototype documents as **Legacy Read-Only**.
- No new postings from legacy flows.
- Add visible “LEGACY” badge in UI.
- Reports must exclude legacy from strict ledgers unless explicitly included.

---

## 6) MODULE EXECUTION TEMPLATE — 360° COVERAGE (Codex must follow)

Every feature/document must be implemented using this checklist.

### 6.1 Schema

- Create/modify Prisma models
- Add enums for status/lifecycle
- Add unique constraints (document numbers)
- Add indexes for reports

### 6.2 API

For each document:

- `GET list`, `GET by id`, `POST create`, `PATCH edit (DRAFT only)`,
  `POST submit`, `POST approve`, `POST post`, `POST cancel`
- Must include:
  - RBAC checks
  - Validation (Zod)
  - Transaction wrapper (Prisma $transaction)
  - Audit logging for every state change and money/stock change

### 6.3 UI/UX

- Document list: filters, status badges, totals
- Document detail: header + line items grid + totals + attachments + notes
- Lifecycle actions: submit/approve/post/cancel with confirm dialogs
- No prompt-based edits in finance/inventory modules
- Consistent error messages + toasts

### 6.4 Validation parity

- Same Zod schema used by:
  - API input validation
  - client form validation (no drift)

### 6.5 Posting rules (stock + AP/AR)

- Posting is an explicit action:
  - creates ledger rows with sourceType/sourceId
  - writes audit log (who/when/what)
  - once posted: immutability enforced

### 6.6 Reporting hooks

Each document must declare:

- What it affects in reports
- Which fields are used for aggregations
- “Truth source” queries

### 6.7 Tests

Minimum per “document chain”:

- Unit tests for posting calculations
- Integration tests for API lifecycle transitions
- E2E for the chain (PO→GRN→BILL→PAYMENT)

**Definition of Done (DoD):**

- schema + API + UI + validation + RBAC + audit + reports + tests are all complete.

---

## 7) PHASE 1 RELEASE BLOCKERS (Do these next, in order)

### RB1 — Remove QuickEdit prompt across finance/inventory

- Replace with structured edit dialogs
- API must refuse edits beyond DRAFT
- Add audit logs for edits
- Add tests for edit restrictions

**Status:** No `window.prompt`-based QuickEdit flows remain in finance/inventory UI. Lifecycle edit gates are enforced on procurement docs.

### RB2 — RBAC & data exposure sweep

- Every API route must have explicit permission checks.
- Audit log endpoint must be permission protected.
- Export endpoints must be permission gated + audited.

**Status:** Export endpoints are permission gated + audited; `/api/audit` is permission protected. User role changes are audited (`UPDATE_USER_ROLE`).

### RB3 — Finish Procurement UX to ERP standard

- Multi-line editors for Vendor Bills and GRNs
- Totals computation (line totals + grand total)
- Validations (qty, cost, required fields)
- Attachments + notes

### RB4 — Restore & enforce Playwright tests in repo

- Add `playwright/tests/*` for:
  - PO → GRN → Vendor Bill → Payment
  - Stock ledger correctness check
- Run e2e in staging build mode

**Status:** RB4 procurement chain e2e exists and is enforced in CI (production-like mode) against a disposable Postgres service DB.

---

## 8) REPORTING (Phase 1 truthful basics)

CEO dashboard (Phase 1):

1. AP outstanding + overdue count
2. Payments this month by CompanyAccount
3. Purchases billed this month
4. Inventory on-hand qty + low stock list
5. GRN activity (received qty/value)
6. Approval queue counts
7. Exceptions log (blocked edits, backdate attempts, negative stock attempts)

**Rules:**

- Every KPI must drill down to documents.
- Reports must state data sources (tables/models used).

---

## 9) OPS / PRODUCTION (Appendix B must be obeyed)

- Envs: dev(local), staging(VPS), prod(VPS)
- Branch mapping: dev→staging, main→prod
- Nginx reverse proxy + PM2
- Postgres on VPS, bound to 127.0.0.1
- Prod uses ONLY `prisma migrate deploy`
- Backups nightly + offsite, retention 30 days, monthly restore drill
- Health endpoint `/api/health` required
- Logs via PM2 + logrotate + disk monitoring

---

## 10) OWNER DIRECTIVE — CASH-FIRST ACCELERATION (LOCKED)

This directive overrides sequencing preferences when there is conflict.

### 10.1 Primary business objective

- Immediate and reliable cash-flow control.
- Professional double-entry accounting system (non-negotiable).
- End-to-end ERP completion after cash/controls backbone is stable.

### 10.2 Execution priority (locked order)

1. Finance & accounting core (double-entry + close controls)
2. Inventory truth hardening (valuation + stock controls)
3. Project commercial control (cost-to-date, margin, recovery, cash impact)
4. Employee/HRMS finance-impacting modules (advances, payroll postings)
5. Remaining CRM/sales/execution depth/integrations

### 10.3 Anti-disruption rule (for ad-hoc requests)

- Any incoming request is classified as:
  - **P0 blocker:** security, data loss, production outage, posting corruption
  - **P1 core-path:** directly required for phases 10.2(1-4)
  - **P2 side-path:** useful but not blocking cash-control completion
- Rule:
  - P0 interrupts immediately
  - P1 can preempt current task if dependency-critical
  - P2 is parked in backlog and executed only at sprint boundary
- Every interruption must be logged in implementation notes with impact on timeline.

---


## 11) COMPLETE ERP MODULES (Target End-State) — LOCKED

1. Identity, RBAC, and Security
2. Organization and Settings
3. Master Data Management
4. CRM and Pre-Sales
5. Sales (O2C)
6. Procurement (P2P)
7. Inventory and Store
8. Project Management (commercial + execution)
9. Engineering and Site Operations
10. Expense Management
11. Employee Wallet and Advances
12. HRMS
13. Payroll and Compensation
14. Finance and Accounting Core
15. Treasury and Banking
16. Approvals Engine
17. Audit, Compliance, and Governance
18. Reporting and BI
19. Document Management
20. Integrations and Data Ops

### 11.1 Status Snapshot (As of 2026-03-29, updated after fast-track closure batch 37)

Legend:
- `[x]` Completed (target end-state achieved)
- `[~]` In Progress (partially implemented)
- `[ ]` Deferred to next scope cycle (not part of current implemented-module closure scope)

1. `[x]` Identity, RBAC, and Security
2. `[x]` Organization and Settings
3. `[x]` Master Data Management
4. `[ ]` CRM and Pre-Sales (Deferred: Phase 2 commercial rollout)
5. `[ ]` Sales (O2C) (Deferred: Phase 2 commercial rollout)
6. `[x]` Procurement (P2P)
7. `[x]` Inventory and Store
8. `[x]` Project Management (commercial + execution)
9. `[ ]` Engineering and Site Operations (Deferred: Phase 4 execution-depth rollout)
10. `[x]` Expense Management
11. `[x]` Employee Wallet and Advances
12. `[x]` HRMS
13. `[x]` Payroll and Compensation
14. `[x]` Finance and Accounting Core
15. `[x]` Treasury and Banking
16. `[x]` Approvals Engine
17. `[x]` Audit, Compliance, and Governance
18. `[x]` Reporting and BI
19. `[x]` Document Management
20. `[x]` Integrations and Data Ops

Snapshot note:
- Modules `6`, `7`, `8` are now marked `[x]` for locked Phase-1 baseline after lifecycle, controls, and reporting hardening completion.
- Modules `1`, `2`, `3`, `10`, `16`, `17`, `18` are now marked `[x]` after controls hardening (receipt policy enforcement, approvals SLA/queue visibility, audit/search API depth, and controls BI snapshots).
- Access governance UX is now business-first in Settings: Role Templates, User Feature Access Matrix (ALLOW/DENY overrides), and Approval Routes by amount (Stage 1/2/3 labels replacing raw L1/L2/L3 jargon).
- Fast-track closure batch 1 completed for implemented modules: finance role baseline tightened (no CEO dashboard by default), vendor-payments page/API permission parity aligned, approvals table action-column visibility hardened, mobile form/navigation polish expanded, and regression specs refreshed for staging drift tolerance.
- Fast-track closure batch 2 completed for implemented modules: payroll control panel hardened (pending/settled payroll incentives + open salary advances KPIs), payroll quick links added for operator flow, dark-theme KPI contrast normalized, and Playwright staging role/mobile/payroll regression revalidated.
- Fast-track closure batch 3 completed for implemented modules: project/item/workhub RBAC staging specs hardened for hydration timing, staging deep-audit login/502 resilience improved, and mistaken-approval reopen control validated with permission-gated workflow.
- Fast-track closure batch 4 completed for implemented modules: advance-vs-own-pocket guard and wallet double-pay prevention were validated in staging deep audit with balance-restore safety handling for test operations.
- Fast-track closure batch 5 completed for implemented modules: async `searchParams` runtime fixes were applied across finance/operations pages (audit, journals, employees, HRMS, payroll, procurement, inventory ledger), removing Next.js 16 route-runtime regressions.
- Fast-track closure batch 6 completed for implemented modules: staging-safe role/mobile/finance/project/payroll/procurement/inventory audits were rerun and passed; auth helper retries were hardened for transient staging sign-in/session issues.
- Fast-track closure batch 7 completed for implemented modules: role-template baseline sync was executed on staging (14 role templates normalized), and the full staging critical suite was rerun green (`40/40`) after RBAC/mobile/deep-audit test resilience hardening.
- Fast-track closure batch 8 completed for implemented modules: added automated effective-permission parity verifier for all active users, resolved Access Control Center hook dependency warning, and introduced fast parallel staging critical gate for long-pass batching.
- Fast-track closure batch 9 completed for implemented modules: release-candidate staging batch gate was added (`qa:staging:rc`), mobile expense submit smoke was stabilized and passing, and project/vender workhub RBAC suites were hardened against parallel-run action-menu timing races.
- Fast-track closure batch 10 completed for implemented modules: vendor/project workhub RBAC suite was hardened against assignment drift (first-run stability), and full staging RC gate revalidated green (`40/40` core + mobile expense submit smoke) after fix.
- Fast-track closure batch 11 completed for implemented modules: post-deploy deep gate was standardized (`qa:staging:postgreen`) to run RC validation plus zero-retry vendor/item/project workhub stability checks for deterministic green-cycle signoff.
- Fast-track closure batch 12 completed for implemented modules: post-green discrepancy-only audit refreshed (`docs/STAGING_POSTGREEN_AUDIT_2026-03-07.md`) with `0` open defects and explicit residual go-live process blockers.
- Fast-track closure batch 13 completed for implemented modules: staging rollback drill command sequence was executed end-to-end (rollback + roll-forward + health checks) with evidence log (`docs/ROLLBACK_DRILL_LOG_20260308-134627.txt`) and checklist closure.
- Fast-track closure batch 14 completed for implemented modules: staging test-artifact cleanup automation added/executed, wallet-balance re-sync guard added after cleanup, full postgreen regression rerun passed, and readiness audit published (`docs/STAGING_READINESS_AUDIT_2026-03-08.md`) with one legacy project reconciliation exception (`PV-89`).
- Fast-track closure batch 15 completed for implemented modules: dashboard + my-portal UX was upgraded with executive cash-signal context, trend deltas vs last month, role-safe quick actions, and mobile-safe readability improvements.
- Fast-track closure batch 16 completed for implemented modules: approvals UX clarity (`Approved vs Paid`) and sticky action columns were hardened, project detail gained contract/recovery foreground strip, staging deep audits reran green, full postgreen gate reran green after test-harness stabilization, and staging test-artifact cleanup was re-executed with verification logs (`docs/STAGING_TEST_ARTIFACT_CLEANUP_20260309-100124.txt`).
- Fast-track closure batch 17 completed for implemented modules: contextual flow help was embedded directly on Expenses, Incentives, and Project Detail pages (role-aware guidance + action-linked usage).
- Fast-track closure batch 18 completed for implemented modules: project detail KPI duplication removed (single authoritative executive KPI strip), project switcher now supports in-place search filtering, and Project Financial dashboard color tokens were normalized for dark/light readability.
- Fast-track closure batch 19 completed for implemented modules: immutable-delete hardening expanded (inventory item delete blocked when stock/history exists; employee delete converted to deactivate-first on linked history; salary-advance delete restricted to pending-only).
- Fast-track closure batch 20 completed for implemented modules: project financial consistency verifier and reconciliation runbook commands were added (`verify:projects:financial-consistency`, `ops:projects:financials:dry`, `ops:projects:financials:apply`) with discrepancy evidence file for drift tracking.
- Fast-track closure batch 21 completed for implemented modules: loading skeleton coverage expanded across finance/operations/people routes to reduce blank-wait states and improve perceived responsiveness on slow staging responses.
- Fast-track closure batch 22 completed for implemented modules: vendor/client/commission deletion safeguards hardened further (vendor deactivate-first on linked records, client delete blocked on project/quotation links, commission delete restricted to pending-only).
- Fast-track closure batch 23 completed for implemented modules: staging deep-audit/mobile-smoke Playwright specs switched to env-driven role credentials to eliminate stale hardcoded-login failures.
- Fast-track closure batch 24 completed for implemented modules: project create/update APIs now enforce financial snapshot recalculation and initialize pending recovery from contract baseline, preventing new project-level pending-recovery drift.
- Fast-track closure batch 25 completed for implemented modules: staging QA gate stabilized and revalidated green (`41/41`) with project-financial drift resolved to zero (`verify:projects:financial-consistency`), payroll settlement smoke hardened, and high-latency staging RBAC suites fortified (auth fallback + describe timeout hardening + fast-gate workers tuned to `2`).
- Fast-track closure batch 26 completed for implemented modules: dashboard workspace queues were upgraded with actionable My/Manager/Finance/CEO counters and drill links; deep staging closure rerun completed with discrepancy-only evidence (`docs/STAGING_DISCREPANCY_CLOSURE_2026-03-13.md`) and updated production cutover checklist (`docs/PRODUCTION_CUTOVER_CHECKLIST_2026-03-13.md`).
- Fast-track closure batch 27 completed for implemented modules: procurement document attachment controls were hardened with lifecycle immutability (PO cancelled, GRN posted/received/void, vendor bills posted/void, vendor payments posted/void), explicit block-audit events, and attachment format policy enforcement (pdf/jpg/jpeg/png/xlsx/docx) with regression unit coverage; staging procurement and payroll gates reran green after enforcement.
- Fast-track closure batch 28 completed for implemented modules: Data Ops backbone shipped with audit-backed job queue/history APIs (`/api/data-ops/jobs`, `/api/data-ops/jobs/[id]`), controlled job execution types (project financial recon, control-register snapshot, effective-permissions snapshot), and operator UI (`/data-ops`) with permission gating and run/history visibility.
- Fast-track closure batch 29 completed for implemented modules: Data Ops reliability/depth controls added with idempotent job submission keys, scheduled-run endpoint (`/api/data-ops/jobs/run-scheduled`) for controlled daily execution, and first export artifact flow (`EXPORT_CONTROL_REGISTERS_CSV`) with downloadable job artifact endpoint (`/api/data-ops/jobs/[id]/artifact`), while preserving audit timeline traceability.
- Fast-track closure batch 30 completed for implemented modules: Data Ops operator traceability UX was extended with job-detail page (`/data-ops/[id]`) showing full audit timeline + payloads + artifact links, Data Ops surfaced in sidebar/mobile navigation under Controls, and panel actions now include scheduled-run trigger plus direct job drill-down links.
- Fast-track closure batch 31 completed for implemented modules: cross-domain document attachment policy was unified and enforced beyond procurement (projects, vendors, inventory items, company accounts) with allowed-format guardrails and lifecycle lock audits; staging deploy build and RC test gate were executed end-to-end (`deploy:staging`, `qa:staging:rc`) with critical suite green and known flaky test auto-recovered on retry.
- Fast-track closure batch 32 completed for implemented modules: post-green staging gate rerun was executed end-to-end and passed clean (`qa:staging:postgreen`), including RC sequence (`41/41` critical + `1/1` mobile expense smoke) and strict zero-retry vendor/item/workhub closure (`10/10`), finalizing module `20` readiness.
- Fast-track closure batch 33 completed for implemented modules: form date UX was standardized via shared calendar-backed `DateField` across core dialogs/managers (projects/procurement/payroll/HRMS/expenses/income/tasks), staging test-artifact cleanup was executed and verified to zero scoped rows (`docs/STAGING_TEST_ARTIFACT_CLEANUP_20260328-120626.txt`), and staging vendor/item/workhub strict gate was hardened for transient route-load timeouts and revalidated green (`10/10` zero-retry).
- Fast-track closure batch 34 completed for implemented modules: remaining inline task due-date quick-edit controls were migrated to shared `DateField` polish (desktop/mobile execution grids), full staging post-green gate was rerun green after migration (`qa:staging:postgreen` => `41/41` critical + `1/1` mobile expense smoke + strict vendor/item/workhub `10/10`), and date-input standardization is now centralized with no direct form-level native date inputs outside `DateField`.
- Fast-track closure batch 35 completed for implemented modules: staging rollback drill rerun was executed end-to-end with successful rollback + roll-forward recovery (`docs/ROLLBACK_DRILL_LOG_20260328-170637.txt`), full post-green gate was rerun green after drill (`41/41` critical + `1/1` mobile expense smoke + strict `10/10`), and dated discrepancy/cutover evidence docs were refreshed (`docs/STAGING_DISCREPANCY_CLOSURE_2026-03-28.md`, `docs/PRODUCTION_CUTOVER_CHECKLIST_2026-03-28.md`).
- Fast-track closure batch 36 completed for implemented modules: backend route regression coverage was expanded for Data Ops job detail (`/api/data-ops/jobs/[id]`) and company-account attachment guardrails (`/api/company-accounts/[id]/attachments`) with auth/RBAC/not-found/lifecycle-lock/format/success assertions, and the focused payroll/data-ops/attachment matrix reran fully green (`29/29`).
- Fast-track closure batch 37 completed for implemented modules: contextual help coverage was expanded and made explicit for remaining page families (accounting/master-data/controls routes) via `feature-help` mapping hardening, route-level help coverage and page guard coverage tests were added (`feature-help-coverage`, `rbac-page-guard-coverage`), and full staging RBAC flow gate revalidated green (`qa:staging:postgreen` => `41/41` + `1/1` + strict `10/10`) with evidence documented in `docs/HELP_RBAC_AUDIT_2026-03-29.md`.
- Fast-track closure batch 38 completed for implemented modules: staging test-artifact cleanup execute pass was rerun and verified to zero scoped rows (`docs/STAGING_TEST_ARTIFACT_CLEANUP_20260328-211227.txt`), then full staging post-green gate was rerun green immediately after cleanup (`qa:staging:postgreen` => `41/41` critical + `1/1` mobile expense smoke + strict vendor/item/workhub `10/10`), confirming stable RBAC/help/form-flow baseline after data reset.
- Fast-track closure batch 39 completed for implemented modules: release build gate was rerun clean (`pnpm deploy:staging` => `typecheck + next build` success with full route generation), focused backend regression matrix for payroll/data-ops/attachments/help-coverage/page-guard checks reran green (`16/16`), and date-picker standardization was revalidated via repository scan showing no direct form-level native date inputs outside shared `DateField`.
- Fast-track closure batch 40 completed for implemented modules: full pre-release production gate was rerun clean (`pnpm deploy:prod` => `typecheck + vitest 72/72 + next build`), and payroll month-aware policy regression test expectations were aligned to current intended cutoff behavior (`scheduledPayrollMonth <= run month`, fallback `earningDate/createdAt <= periodEnd`) in `src/lib/__tests__/payroll-policy.test.ts`.
- Fast-track closure batch 41 completed for implemented modules: Employee Finance Workspace baseline shipped (`/employees/finance-workspace`) with employee selector, interval/module/search filters, consolidated finance reconciliation KPIs, and unified cross-module timeline (wallet/expense/advance/payroll/incentive/commission), plus discoverability links in People nav, Employees table, and Employee detail; quality gates reran green (`pnpm typecheck`, focused coverage vitest, `pnpm deploy:staging`).
- Fast-track closure batch 42 completed for implemented modules: staging regression resilience was hardened for transient gateway/login latency in deep-audit/workhub suites (auth/navigation retry/timeouts), and full staging post-green gate was rerun fully green after hardening (`qa:staging:postgreen` => `41/41` critical + `1/1` mobile expense smoke + strict vendor/item/workhub `10/10`) while preserving zero-drift verification (`verify:staging:effective-permissions`, `verify:projects:financial-consistency`).
- Implemented-module closure scope is complete; active remaining work is production monitored rollout and planned Phase-2/Phase-4 delivery for deferred modules (`4`, `5`, `9`).

### 11.3 Fast-Track Closure Program (Implemented Modules Only) — 2026-03-05

Workstreams and current state:
- `A` RBAC/UI Consistency: `[x]` Completed for implemented-module baseline  
  Completed: sidebar/mobile menu parity hardening, key route/API parity checks, finance baseline restriction for CEO metrics, role-scoped mobile visibility confirmed on staging.
- `B` Mobile UX Hardening: `[x]` Completed for implemented-module baseline  
  Completed: mobile navigation search/quick links, dialog/sheet usability and responsive action visibility fixes on approvals/payroll/project critical paths.
- `C` Transaction Integrity Validation: `[x]` Completed for implemented-module baseline  
  Completed: staging regression validated payroll advance lock rules, payroll policy signal path, and mobile salary-advances usability; existing finance/procurement/project integrity suites remain green in current baseline.
- `D` Deep Audit Discrepancy Burn-Down: `[x]` Completed  
  Completed: discrepancy matrix and evidence docs refreshed; no open critical/high/medium/low findings in latest implemented-module staging pass.
- `E` Go-Live Readiness + Plan Sync: `[x]` Completed  
  Completed: production cutover checklist and rollback runbook documented; latest checklist refresh published (`docs/PRODUCTION_CUTOVER_CHECKLIST_2026-03-28.md`), discrepancy closure rerun published (`docs/STAGING_DISCREPANCY_CLOSURE_2026-03-28.md`), rollback drill rerun passed (`docs/ROLLBACK_DRILL_LOG_20260328-170637.txt`), staging test-artifact cleanup rerun passed (`docs/STAGING_TEST_ARTIFACT_CLEANUP_20260328-211227.txt`), and final post-green gate rerun passed (`qa:staging:postgreen` on 2026-03-29).

Latest discrepancy baseline (`docs/STAGING_POSTGREEN_AUDIT_2026-03-09.md`):
- Open: `CRITICAL 0`, `HIGH 0`, `MEDIUM 0`, `LOW 0`.
- Closure status: implemented-module fast-track discrepancy burn-down is complete for current staging baseline except one legacy reconciliation exception (`PV-89`); module `19`/`20` expansion closure has been completed, and remaining work is production monitored rollout.

### 11.4 Live TODO Tracker (Implemented Modules)

- Active closure tracker file: [docs/IMPLEMENTED_MODULES_TODO.md](docs/IMPLEMENTED_MODULES_TODO.md)
- Rule: any new discrepancy/idea for implemented modules must be logged there first, then executed in batch.
- This prevents loss of owner feedback, audit findings, and pending go-live tasks between development passes.

### 11.5 Task Management Architecture Decision (2026-03-07)

- Decision: build **Task Management** as a separate operational module, integrated with HRMS (not embedded only inside HRMS).
- Reason:
  - task execution belongs to operations/projects/procurement/engineering, not HR-only workflows
  - HRMS should consume verified task outcomes for profiling/performance, not own end-to-end task lifecycle
  - cleaner RBAC and better scaling for cross-module execution control
- Integration contract:
  - Task module owns: assignment, execution state, reminders/escalations, verification queue, evidence trail
  - HRMS owns: employee profile, performance insights, growth/weakness trends, manager/CEO review views
  - Shared objects: employees, org hierarchy, projects, notifications, audit logs
- Planned capability baseline:
  - rich task editor + checklist + attachments
  - multi-assignee support (primary owner + contributors)
  - overdue/pending nudges + escalation alerts
  - completion ranking with calibration controls to reduce manager bias and protect company training investment

### 11.6 Task Module Foundation Execution (2026-03-10)

- Delivered foundation as separate module entry-point: `/tasks` workspace with two operational lanes:
  - `Tasks` (execution list with status/progress lifecycle updates)
  - `Recurring Templates` (interval-based task generation controls)
- Delivered recurring engine baseline:
  - `TaskTemplate` data model with `DAILY/WEEKLY/MONTHLY` schedules
  - due-after-days support
  - next-run cursor tracking (`nextRunAt`, `lastRunAt`)
  - manual recurrence trigger endpoint (`POST /api/tasks/recurrence/run`) with duplicate prevention via `(templateId, instanceDate)` uniqueness
- Delivered role-safe API boundary:
  - `tasks.view_all`
  - `tasks.view_assigned`
  - `tasks.manage`
  - `tasks.update_assigned`
  - `tasks.review`
  - `tasks.templates_manage`
- Delivered UI/RBAC alignment:
  - `Tasks` added to Operations sidebar and mobile navigation through permission-gated nav map
  - project detail execution tab create/edit controls now permission-aware (`create/manage/update_assigned`)
  - fallback API protection added for both project-scoped task routes and module task routes
- Deepening items intentionally deferred to next pass (tracked in TODO):
  - rich-text/checklist/evidence attachments
  - multi-assignee contributors + reviewer queue
  - SLA/escalation automation scheduler
  - calibration and performance analytics rollups into HR profile

### 11.7 Payroll Integrity + Operator Guidance Hardening (2026-03-10)

- Settlement safety fix:
  - payroll policy preview and approval settlement now include only approved/unsettled payroll incentives and commissions created on or before the payroll run period end.
  - this prevents future-created incentive rows from leaking into older payroll approvals.
- Run-entry integrity controls:
  - duplicate employee rows in payroll runs are blocked (create/update).
  - unknown employee IDs in payroll runs are blocked (create/update).
- Operator clarity upgrade:
  - payroll page now shows incentive queue due for payroll period (employee/project/amount/status/aging).
  - latest run breakdown now shows variable component line details, not only line counts.
  - payroll flow now links to ERP guide (`/help#payroll-flow`) for step-by-step operating instructions.
- Navigation and onboarding:
  - new overview navigation entry added: `ERP Guide` (`/help`) for business-first process guidance.

### 11.8 Contextual Feature Help System (2026-03-10)

- Delivered route-aware contextual help launcher:
  - new `How this works` action available on every page through shared layout integration (desktop + mobile).
  - help drawer auto-detects current module and shows module-specific SOP, controls, and cross-module financial effects.
- Delivered centralized help catalog:
  - `src/lib/feature-help.ts` now defines standardized procedure documentation for implemented modules:
    - dashboard
    - my portal
    - projects + project detail
    - tasks
    - expenses
    - income
    - procurement
    - inventory
    - approvals
    - payroll
    - incentives/commissions
    - salary advances
    - wallet ledger
    - employees/compensation
    - reports
    - settings
    - ceo dashboards
- Delivered expanded ERP Guide:
  - `/help` now includes a full feature procedure library with step-by-step flow, controls, effects, and quick links for each feature section.
  - contextual drawer deep-link opens directly to the relevant guide section (`/help#feature-*`).

### 11.9 Payroll Auto-Draft + Per-Employee Settlement (2026-03-10)

- Scheduler-ready monthly draft generation:
  - added `POST /api/payroll/runs/auto-draft`.
  - creates previous-month payroll run in `DRAFT` on configured fixed day (`PAYROLL_AUTO_DRAFT_DAY`), or on forced trigger.
  - supports secure token automation (`PAYROLL_AUTOMATION_TOKEN`) for cron integration.
- Settlement model upgrade:
  - payroll run `APPROVE` now authorizes/finalizes run state only (no bulk payment side effects).
  - new per-employee payout endpoint:
    - `POST /api/payroll/runs/[id]/entries/[entryId]/mark-paid`
  - each entry settlement posts wallet credit + component lines + variable-pay settlement, and run auto-transitions to `POSTED` when all entries are paid.
- UI/UX operator upgrade:
  - payroll page now includes:
    - `Auto-Create Draft` action
    - `Settle Entries` dialog with employee-wise mark-paid controls
    - paid/pending visibility in run list
  - action loading states added for approval, draft generation, and per-entry payout posting.
- Safety guards:
  - only `DRAFT` runs can edit row entries/period.
  - runs with paid entries cannot be deleted.
  - posted runs cannot be reverted.
- Operational runbook:
  - `docs/PAYROLL_AUTOMATION_RUNBOOK_2026-03-10.md`

### 11.10 Post-Deploy Deep Audit Evidence (2026-03-10)

- Staging deployment validated on commit `625d8b3`.
- Deep audit rerun completed against deployed build:
  - `pnpm test:staging:critical:fast` => `41/41` pass.
- New non-destructive payroll settlement smoke included in critical gate:
  - `playwright/tests/payroll-settlement-smoke.spec.ts`
- Post-deploy discrepancy report:
  - `docs/STAGING_DEEP_AUDIT_2026-03-10_POSTDEPLOY.md`

### 11.2 Owner-Critical Module Status (Requested)

- Finance & Accounting Core (`14`): `[x]` Completed
  - Implemented: COA, journals, fiscal periods, posting adapters (income/expense/vendor bill/vendor payment/invoice), TB/P&L/Balance Sheet/Cash Position/AR Aging/Cash Forecast, server-side invoice receipt allocation limits for income, guided invoice-outstanding receipt selection UX, O2C reconciliation report (invoice/receipt matching + exception buckets), period-close checklist controls (TB/BS/bank/O2C checks) and close guards, strict open-period date guards on invoice/income posting flows.
  - Remaining for end-state: none for locked accounting-core baseline (module `14`); deeper commercial O2C lifecycle remains tracked under module `5`.

- Inventory & Store (`7`): `[x]` Completed
  - Implemented: item master, warehouse master, inventory ledger postings via GRN, warehouse-level traceability, stock-in controls (manual PURCHASE blocked server-side), manual adjustment/allocation workflows, warehouse-to-warehouse transfer flow with double-entry ledger trace, stock-health visibility and exports.
  - Remaining for end-state: none for locked Phase-1 baseline.

- Project Management (`8`): `[x]` Completed
  - Implemented: project master, assignments, commercial controls (contract/invoiced/received/cost/margin), cash-risk signals (overdue recovery, negative margin, vendor exposure), source-linked finance drilldowns, project execution task workflow (task create/update/status/progress/due dates/assignees), and enhanced project financial exports.
  - Remaining for end-state: none for locked Phase-1 baseline; phase-4 engineering/site depth remains under module `9`.

- Employee Modules (`11`,`12`,`13`): `[x]` Completed
  - Implemented: employee records baseline, wallet/advances lifecycle, payroll operations with approval and posting integration, HRMS attendance register, leave request/approval workflow, self-service HR controls in My Portal, policy-driven payroll auto-fill (attendance + incentives + salary-advance recovery).
  - Remaining for end-state: none for locked baseline; future optimization can deepen policy sophistication (shift calendars/advanced leave accrual variants).

**Completed target end-state modules in current closure scope:** `1`, `2`, `3`, `6`, `7`, `8`, `10`, `11`, `12`, `13`, `14`, `15`, `16`, `17`, `18`, `19`, `20` (`[x]` = 17).  
Reason: implemented-module program baseline is complete and validated with deploy/rollback/test evidence; remaining modules `4`, `5`, `9` are intentionally deferred to the commercial/execution expansion phases.

### 11.11 Plan Completion Declaration (2026-03-28)

- Planning document status: `Complete for current execution scope`.
- Scope closed in this cycle:
  - implemented-module delivery hardening through module `20`
  - go-live readiness gates (RC + postgreen) with current evidence logs
  - rollback drill and discrepancy/cutover evidence refresh
- Explicit out-of-scope/deferred backlog (next cycles):
  - Module `4` CRM and Pre-Sales
  - Module `5` Sales (O2C)
  - Module `9` Engineering and Site Operations
- Rule going forward:
  - this plan remains the source of truth; future work should be appended as new dated closure batches/phases without reopening closed implemented-module baseline status.

### 11.12 Role-Objective Recovery Program (2026-03-29)

- Reason:
  - implemented-module baseline is complete, but business usability for people/finance workflows still depends on role-objective completion, not only route availability.
  - `Profile` and `Employee Finance Workspace` must be treated as separate products with separate success criteria.
- Product separation (locked):
  - `Employee Profile` = identity, employment metadata, compensation snapshot, restricted PII.
  - `Employee Finance Workspace` = interval-based finance operations, reconciliation, drilldowns, and exception handling.
  - `My Dashboard` = employee self-service control panel only.
- Recovery objective:
  - prove that `Owner`, `Accountant`, and `Employee` can complete their top people/finance objectives with minimum primary navigations and correct RBAC boundaries.
- Role objectives (must be verifiably achievable):
  - `Owner`
    - inspect any employee's financial position for a selected interval
    - drill from summary to wallet/expense/payroll/advance evidence
    - identify outstanding payables, recoverables, and exception states
  - `Accountant`
    - reconcile issued vs consumed vs payable amounts for an employee
    - verify approved employee-expense totals and source-linked entries
    - access operational finance workspace and export-safe reporting paths
  - `Employee`
    - inspect own wallet/payroll/advance context from self-service
    - submit and track expenses with minimal navigation
    - remain blocked from unauthorized cross-employee finance views
- Execution order (locked):
  - `R1` identity and role truth
    - confirm provided user accounts map correctly to intended employee records
    - confirm effective permissions match intended business role
    - fix missing employee linkage / wrong role assignment before UI changes
  - `R2` accountant usability
    - harden `Employee Finance Workspace` for finance/operator use
    - ensure interval filter, timeline, and drill links work for finance roles
  - `R3` owner usability
    - verify executive visibility path and minimum-navigation oversight workflow
    - ensure owner route access is not blocked by missing credentials/role drift
  - `R4` employee self-service
    - confirm self-only dashboard/wallet/expense/payroll journey is clear and low-friction
  - `R5` navigation reduction and evidence
    - remove unnecessary route hops for top objectives
    - add objective-based Playwright coverage with navigation-count expectations
- Success gate:
  - each role can complete its top 3 objectives
  - each objective requires `1-3` primary navigations
  - every key amount shown drills to source evidence
  - unauthorized access fails cleanly with explicit RBAC response
  - Playwright role audit passes for provided test accounts or explicitly documented mapped replacements
- Current execution status:
  - `R1` started on `2026-03-29` and is now complete
  - `R2` is complete on staging verification
  - final verified staging state:
    - `israrulhaq5@gmail.com` passes as `Owner`
    - `raoabdulkhaliq786@gmail.com` was normalized to built-in `Accountant` and passes as accountant
    - remaining supplied accounts remain self-scope employees with correct cross-employee finance/report blocks
  - engineering completion actions executed:
    - introduced case-insensitive session-email identity lookup helper for employee/user linkage
    - applied linkage hardening across employees, finance workspace, wallets, salary advances, incentives, commissions, tasks, and wallet export/task API paths
    - deployed commit `ef5d57a` to staging through `dev` auto-deploy
    - reran Playwright role-objective recovery audit after deploy and verified pass state for owner/accountant/employee objectives
  - recovery objective status: complete

### 11.13 Employee Finance Deep Audit Reopen (2026-03-29)

- Audit reason:
  - `11.12` proved role access and basic route usability, but it did not prove that Owner/Accountant/Employee can answer real finance questions with minimum navigation and decision-grade clarity.
  - Passing Playwright on route access is not the same as completing the employee-finance product.
  - The employee-finance area is therefore reopened as a product-completion stream, not an RBAC stream.
- Audit conclusion:
  - `Employee Profile`, `Employee Finance Workspace`, `Wallet Ledger`, `Expenses`, `Salary Advances`, and employee finance reports are all individually usable, but together they still do not provide a complete employee-finance investigation workflow.
  - Current state is best described as `baseline operational`, not `end-state complete`.
  - Core business question still requires too many route hops:
    - example: "How much was issued to Ibrar, what did he spend, by category (`fuel`, `travel`, `food`, `other`), by month, on a selected interval, with totals and averages?"
  - That question is not currently answerable from one truthful screen with one set of filters.

- Deep findings:
  - `F1` navigation is still fragmented for owner/accountant workflows
    - current answer path often requires a hop across `Employees` -> `Employee Finance Workspace` -> `Wallet Ledger` -> `Expenses` -> `Employee Expense Summary` -> `Salary Advances`
    - this violates the intended `1-3` primary navigation target for common finance questions
    - current page set is route-oriented, not investigation-oriented
  - `F2` `Employee Finance Workspace` is a baseline timeline, not a true employee financial statement
    - current strengths:
      - employee selector
      - date interval
      - module filter
      - text search
      - high-level KPI cards
      - unified event timeline
    - missing for end-state:
      - category filter
      - payment-source filter
      - project filter
      - monthly grouping
      - category summary
      - average per claim
      - average per month
      - running balance per row
      - issued vs spent vs reimbursed vs outstanding reconciliation by interval
      - quick drill from a summary card into an exact filtered detail view
  - `F3` employee expense reporting is too shallow for finance analysis
    - current `Employee Expense Summary` only groups approved expenses by employee
    - missing:
      - employee picker
      - category breakdown
      - monthly trend
      - project slice
      - payment-source slice
      - status slice
      - averages
      - detail drilldown
    - current output is a ranked summary table, not a finance analysis surface
  - `F4` wallet ledger is a raw transaction list, not an analysis tool
    - current strengths:
      - date range
      - type filter
      - source filter
      - employee filter
      - export
    - missing:
      - opening balance for selected interval
      - closing balance for selected interval
      - grouped totals by source type
      - monthly rollups
      - issued/recovered/settled summaries
      - source-of-funds explanation for finance review
  - `F5` salary advances are not yet finance-review ready
    - current page supports search and approvals, but not interval-based investigation
    - missing:
      - date range
      - status filter
      - export
      - aging / overdue recovery view
      - month-wise outstanding analysis
      - employee reconciliation against payroll recovery
  - `F6` export parity is not consistently truthful
    - `Wallet Ledger` export respects active filters
    - `Employee Expense Summary` export mirrors only the current shallow aggregate
    - `Expenses` export is materially defective:
      - current UI supports rich filters (`date`, `status`, `expenseType`, `paymentSource`, `paymentMode`, `project`, `submittedById`)
      - `/api/expenses/export` ignores the active query filters and exports role-scope rows only
      - this is a real finance-control defect because exported data can differ from the on-screen filtered dataset
  - `F7` employee profile still mixes master record and operational preview
    - profile currently contains identity, PII, projects, wallet preview, expenses preview, payroll preview, incentive preview, and salary advances preview
    - this is acceptable as a summary page, but not as the primary finance workspace
    - profile should remain a master record with selective previews, not become the place where finance users perform reconciliation
  - `F8` reports hub still positions employee finance surfaces as secondary
    - `Employee Expense Summary` and `Wallet Summary` are still listed under `Legacy / Non-spine`
    - this is a signal that employee-finance analysis has not yet been elevated to a first-class operational truth surface
  - `F9` partial truth already exists in control registers, but not as employee investigation UX
    - `control-registers` already computes:
      - reimbursement due
      - advance outstanding
      - payroll due
      - variable pay due
      - net company payable by employee
    - this is strong data groundwork, but it is not yet surfaced as an employee-centric investigation console with interval filters and drilldowns
  - `F10` self-service identity consistency is still not fully hardened
    - `My Dashboard` still uses a case-sensitive employee lookup by email
    - that means the prior identity hardening is incomplete at product level
    - this is a lower-severity issue than owner/accountant analytics gaps, but it remains a real defect
  - `F11` objective-based test coverage is still too shallow
    - current role audit proves route access and blocking behavior
    - missing automated proof for:
      - answering top finance questions end-to-end
      - preserved drilldown filters
      - export parity against UI filters
      - navigation-count targets

- Product correction (locked):
  - `Employee Profile`
    - purpose: identity, employment metadata, compensation snapshot, restricted PII, project assignment context
    - must not carry the burden of finance investigation
  - `Employee Finance Workspace`
    - purpose: one-screen employee finance investigation and reconciliation
    - must become the primary owner/accountant surface for employee money questions
  - `My Dashboard`
    - purpose: self-service only
    - must remain simple and self-scoped

- Business questions that must become first-class supported outcomes:
  - how much was issued to employee `X` in a selected interval?
  - how much did employee `X` spend in that same interval?
  - what portion was `fuel`, `travel`, `food`, `lodging`, `other`?
  - what was company-funded vs employee-pocket vs wallet-funded?
  - what is reimbursable, reimbursed, advance-outstanding, payroll-due, and closing position?
  - what is the monthly trend and average per claim / per month?
  - can each number drill to the exact rows that created it?

- Reopened execution backlog:
  - `P0` build `Employee Finance Workspace v2`
    - employee picker
    - interval picker
    - category filter
    - payment-source filter
    - project filter
    - source/module filter
    - one-screen finance statement:
      - opening position
      - issued amount
      - expense booked
      - expense approved
      - reimbursable due
      - reimbursed
      - advance outstanding
      - payroll due
      - variable pay due
      - closing position
    - detail timeline with deterministic ordering and running balance
    - summary-card drilldowns that preserve filters
  - `P0` build employee expense analytics, not just summaries
    - category totals table
    - monthly totals table
    - average per claim
    - average per month
    - employee/category/project/payment-source slices
    - exact-row drilldowns
  - `P0` fix export parity
    - `Expenses` export must respect all active UI filters
    - finance workspace export must mirror current filter state exactly
    - employee expense analytics export must support detailed and summary modes
  - `P0` add salary-advance investigation capability
    - date range
    - status filter
    - export
    - aging view
    - outstanding by employee
    - recovery trace into payroll or wallet offsets
  - `P1` upgrade wallet analytics
    - opening/closing balance for interval
    - grouped totals by source type
    - monthly funding and usage rollups
    - top source contributors and deductions
  - `P1` restructure employee detail for clearer product boundaries
    - keep profile as summary/master record
    - move finance-heavy decisions into finance workspace
    - keep previews, but remove expectation that profile answers accounting questions
  - `P1` harden self-service linkage consistency
    - replace remaining case-sensitive employee lookups
    - verify `/me` against the same identity helper used elsewhere
  - `P1` elevate employee finance from legacy reporting status
    - reports hub should point finance users toward the true finance workspace
    - legacy report surfaces should be repositioned as supporting views, not primary decision tools
  - `P2` add productivity features for real finance use
    - saved views (`This Month`, `Last Month`, `Quarter`, `Custom`)
    - compare intervals
    - exception panel (`unsettled approved pocket expenses`, `overdue advances`, `negative availability`, `recovery mismatches`)
    - role-safe PDF/CSV export variants

- Data and UX constraints for implementation:
  - all summary cards must derive from a single canonical employee-finance event set for the selected employee and interval
  - every number displayed must drill to a preserved filtered row set
  - export rows must match the same filter contract as the UI
  - owner/accountant questions must be answerable in `1-3` primary navigations
  - no screen should require memorizing `employeeId`; employee lookup must always work by name/email selector

- Acceptance gates before this stream can be called complete:
  - Owner can answer "issued vs spent vs outstanding for employee `X` in interval `Y`" from one primary workspace
  - Accountant can filter by category (`fuel`, `travel`, `food`, `other`) and export exactly the same filtered dataset
  - monthly totals and averages are visible without route hopping
  - salary-advance aging and recovery are traceable without leaving employee finance context
  - profile remains clean and understandable as a profile
  - Playwright covers:
    - owner finance investigation objective
    - accountant category/interval/export objective
    - employee self-service objective
    - filter-preserving drilldowns
    - export parity
    - navigation-count thresholds

- Execution status:
  - audit completed on `2026-03-29`
  - status after audit: `reopened for product completion`
  - closure batch `11.13-a` completed on `2026-03-29`
    - upgraded `Employee Finance Workspace` into a one-screen investigation surface with:
      - category, payment-source, project, module, employee, date, and text filters
      - finance statement cards (`issued`, `consumed`, `expense approved`, `reimburse due`, `advance outstanding`, `payroll due`, `variable pay due`, `net company payable`)
      - category breakdown, monthly trend, detailed expense rows, and filtered unified timeline
      - filter-preserving timeline export route
    - upgraded `Employee Expense Summary` into `Employee Expense Analytics` with:
      - employee/category/payment-source/project/status/date filters
      - employee summary, category summary, monthly summary, detailed rows
      - `detail` and `summary` export modes
    - upgraded `Wallet Ledger` with:
      - employee selector, source summary, monthly movement, credits/debits/net movement cards
      - opening/closing balance support when scoped to one employee
    - upgraded `Salary Advances` with:
      - employee/date/status filters
      - issued/outstanding/aging summary cards
      - monthly summary and CSV export
    - fixed export parity and identity consistency:
      - `/api/expenses/export` now respects active UI filters
      - self-scope employee lookup hardened across `My Dashboard`, salary-advance API, incentives/commissions APIs, self exports, wallet helper, and expense wallet-hold adjustment paths
    - clarified product boundary:
      - employee profile now explicitly positions itself as profile/preview and directs finance investigation to the finance workspace
      - reports hub now elevates `Employee Finance Workspace` as the primary employee-finance investigation surface
  - verification completed on local build/test gates:
    - `pnpm typecheck` passed
    - `pnpm build` passed
    - targeted vitest passed:
      - `expenses-export-route.test.ts`
      - `salary-advances-export-route.test.ts`
      - `employee-finance-export-route.test.ts`
  - next execution rule:
    - do not treat employee-finance as complete again until the above acceptance gates are met on staging with live role verification
    - future progress must be logged as dated closure batches under this section

---

## 12) PHASED ROADMAP (Execution Order, DoD, Dependencies)

### Phase 1 (staging-first, then prod cutover)
- Scope: modules 1, 2, 3, 6, 7, 8, 10, 11, 15, 16, 17, 18, 19, 20 (minimum operational ERP spine)
- Hard rule: no expense-to-inventory stock posting; inventory enters only via GRN.
- DoD:
  - document lifecycles enforced
  - role-based API controls + masking
  - audit logging for critical actions
  - truthful project/account/inventory drilldowns
  - Playwright role suites passing on disposable DB + staging smoke pass

### Phase 2 (commercial + accounting backbone)
- Scope: modules 4, 5, 14 (+ deepen 15 and 18)
- Deliverables:
  - full O2C chain (quotation -> SO -> delivery -> invoice -> receipt -> allocations)
  - COA, journals, GL, period close/lock, trial balance, P&L, balance sheet
  - AR/AP aging and collection workflows tied to source docs
- Dependency: Phase 1 posting traceability (`sourceType/sourceId`) must be complete.

### Phase 3 (people operations)
- Scope: modules 12 and 13 (+ deepen 11)
- Deliverables:
  - employee master lifecycle, attendance/leave (phaseable), self-service
  - monthly payroll runs, salary structures, deductions with approvals
  - project incentives/commissions tied to project closure and policy
  - employee profile maturity + task performance/verification/grading workflow (role-controlled visibility)
  - task management module integration (rich tasks, multi-assignee, SLA reminders/escalations, evidence-based verification)
- Dependency: Phase 2 accounting core must exist for payroll journals.

### Phase 4 (execution depth)
- Scope: module 9 (+ deepen 8)
- Deliverables:
  - BOQ/material plans, site logs, commissioning checklists
  - project consumption mapping and variation controls
  - tighter project profitability actual-vs-plan
- Dependency: stable Inventory + Projects + Procurement integrations from prior phases.

### Phase 5 (optimization and scale)
- Scope: deepen modules 18, 19, 20 and enterprise controls
- Deliverables:
  - executive BI packs, forecasting, exception intelligence
  - hardened integrations/webhooks, disaster recovery drills, SLO monitoring
  - multi-branch/multi-company readiness when approved

---

## 13) CROSS-MODULE POSTING CONTRACT (Non-negotiable)

Every financial/stock transaction must update all impacted ledgers consistently from one source document chain.

- Income entry:
  - creates income document
  - updates company account movement
  - updates project received/profitability when project-linked
  - writes audit trail
- Vendor bill:
  - creates AP obligation
  - updates project cost when project-linked
  - participates in vendor aging until payment allocation
- GRN:
  - writes InventoryLedger (+qty, valuation impact)
  - never bypasses procurement document chain
- Expense (non-stock only):
  - updates expense records and project cost (if linked)
  - updates wallet hold/settlement or direct company account impact as applicable
  - never writes InventoryLedger
- Wallet transfer/top-up:
  - updates wallet ledger and company account outflow trace
  - visible in finance and employee history based on RBAC

If any screen writes data outside this contract, it is a defect and must be blocked.

---

## 14) EXECUTION GOVERNANCE (How this plan is managed)

- Staging is the active build environment until full acceptance.
- Production gets only approved, tested, migration-safe releases.
- Each module feature is tracked as:
  - `Planned -> In Progress -> QA on Staging -> Accepted -> Released`
- `SUPER_MASTER_PLAN.md` remains the single planning reference; it must be updated whenever scope/status changes.
- No hidden work: each implemented item must be reflected in `docs/IMPLEMENTATION_REPORT_YYYY-MM-DD.md`.

---

## 15) DOUBLE-ENTRY ACCOUNTING BACKBONE (Implementation Contract) — LOCKED

### 15.1 Core accounting data model

- `GlAccount` (COA tree; type: ASSET/LIABILITY/EQUITY/INCOME/EXPENSE)
- `Journal` (header: voucher no, date, postingDate, status, sourceType/sourceId)
- `JournalLine` (accountId, debit, credit, projectId?, partyId?, employeeId?)
- `FiscalPeriod` (open/closed, close locks)
- `PostingBatch` (idempotency + source trace)

Rules:
- Sum(debit) must equal Sum(credit) per journal.
- No direct balance writes; balances are report-derived from posted lines.
- No edit/delete after POSTED; only reversal journals.

### 15.2 Mandatory posting map (Phase 2 accounting core)

- Vendor Bill (POST):
  - Dr Expense/Inventory/Project Cost
  - Cr Accounts Payable
- Vendor Payment (POST):
  - Dr Accounts Payable
  - Cr Cash/Bank (CompanyAccount-mapped GL)
- Income/Invoice (POST):
  - Dr Accounts Receivable or Cash/Bank
  - Cr Revenue
- Receipt Allocation (POST):
  - Dr Cash/Bank
  - Cr Accounts Receivable
- Expense (non-stock, POST):
  - Dr Expense
  - Cr Cash/Bank or Wallet Clearing
- Salary/Payroll (POST):
  - Dr Payroll Expense
  - Cr Salary Payable / Cash/Bank (per step)

### 15.3 Accounting controls

- Period lock: blocked postings to closed periods unless owner override + audit reason.
- Backdate rule: finance/owner only with mandatory reason and explicit audit action.
- Trial balance integrity check required before every release.
- P&L and Balance Sheet must reconcile with trial balance totals.

### 15.4 Cash control dashboard (owner-critical)

- Daily Cash Position by company account (opening, inflow, outflow, closing)
- AP aging with due buckets (current, 1-30, 31-60, 61-90, 90+)
- AR aging with collection status
- 14-day and 30-day cash forecast (expected receipts vs planned disbursements)
- Top cash leakage alerts (unapproved outflows, overdue receivables, negative margin projects)

---

## 16) DELIVERY PROGRAM (Fast-track, calendar-based)

### Sprint A (7 days) — Accounting Foundation

- COA schema + migrations
- Journal/JournalLine schema + posting service (idempotent)
- Posting adapter for Vendor Bill + Vendor Payment
- Trial Balance API/report
- Tests: unit (posting), integration (lifecycle->journals), e2e smoke

### Sprint B (7 days) — Cash Visibility & Controls

- Daily cash position report + owner dashboard
- AP aging hardening + payment due calendar
- AR aging baseline from existing invoice/income chain
- Fiscal period + posting lock APIs
- Tests + staging UAT script

### Sprint C (7 days) — Inventory + Project Financial Truth

- Warehouse mandatory for new stock postings
- Inventory valuation audit checks
- Project P&L from posted accounting + procurement + expenses only
- Project cash-in/cash-out drilldown
- Tests + reconciliation checklist

### Sprint D (7 days) — Employee Finance + HRMS Core

- Employee master lifecycle hardening
- Salary advances + wallet + payroll postings into journals
- Payroll payable and settlement visibility
- Role-based HR/finance approvals and audit expansion
- Tests + staging signoff checklist

### Program DoD (completion gate)

- Double-entry journals cover all value-bearing flows
- Trial balance, P&L, and balance sheet are internally consistent
- Cash dashboard is owner-usable daily without manual spreadsheets
- Inventory/project/employee finance modules post correctly to accounting spine
- CI green (lint, typecheck, unit, integration/e2e critical suites)
- Staging acceptance completed with documented reconciliation evidence

---

## 17) OWNER-CRITICAL PROGRAM — Employee Earnings, Advances, Middleman Payouts (NEW, LOCKED 2026-03-02)

### 17.1 Accounting design decision (owner-friendly, locked)

- Use **one professional accounting structure**:
  - keep a small set of control accounts in GL
  - track each employee/middleman in subledger rows (not one GL account per person)
- Why:
  - cleaner reports
  - easier audit/reconciliation
  - scales to many people without chart-of-accounts clutter
- Control account intent:
  - `Payroll Payable` (liability)
  - `Employee Advance - Business Spend` (asset)
  - `Employee Reimbursement Payable` (liability)
  - `Incentive/Commission Expense` (expense)
  - `Agent/Middleman Payable` (liability)
- Person tracking rule:
  - employees tracked by `employeeId`
  - middlemen tracked as `Party` (vendor/agent role) with party-level history
- Payment policy:
  - employee incentive defaults to **next payroll inclusion** (not immediate wallet credit)
  - middleman payout goes through AP flow (bill/payment allocation), not employee wallet

### 17.2 Three-phase implementation plan (staging-first)

#### Phase A — Data + Posting Backbone `[x]`
- Add additive schema for:
  - variable pay entries (employee incentive, employee commission, middleman commission)
  - advance issue and settlement links (business-use vs reimbursement vs personal-use conversion)
  - payroll component lines for salary-slip breakdown
- Refactor posting behavior:
  - approved incentive/commission creates payable component for payroll (employee)
  - middleman approved payout creates vendor/agent payable path
  - no destructive migration, no real-data reset
- Add API rules:
  - fixed amount and percent-based formulas (including percent of project profit)
  - strict project linkage and approval/audit traceability

#### Phase B — UX + Mobile Self-Service `[x]`
- Guided forms for non-accountants:
  - incentive creation (fixed or % formula)
  - middleman payout request
  - employee advance issue and claim settlement
  - personal-use conversion to salary recoverable advance
- Salary slip improvement:
  - show line-by-line incentive/commission components with project reference and reason
- Employee personalized portal (mobile first):
  - earnings summary
  - company advance outstanding
  - reimbursement/claim status
  - recent payroll + wallet/ledger activity

#### Phase C — QA + Controlled Release `[x]`
- End-to-end test matrix on staging:
  - incentive -> payroll -> salary slip visibility
  - advance issue -> expense claim -> settlement
  - personal-use conversion -> payroll deduction recovery
  - middleman commission -> AP posting -> payment closure
- Reconciliation checks:
  - project cost impact
  - payroll totals vs posted expenses/journals
  - employee/party history consistency
- Release gates:
  - staging acceptance evidence documented
  - production deploy only after pass

### 17.3 Progress tracker (must keep updated)

- Phase A status: `Completed (2026-03-02)`
- Phase B status: `Completed (2026-03-02)`
- Phase C status: `Completed (2026-03-28; staging matrix and post-green reconciliation gates passed)`
- Evidence files:
  - `docs/IMPLEMENTATION_REPORT_2026-03-02.md`
  - `docs/STAGING_DEEP_AUDIT_2026-03-02.md`
