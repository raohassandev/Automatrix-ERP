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

### 11.1 Status Snapshot (As of 2026-03-06, updated after fast-track closure batch 3)

Legend:
- `[x]` Completed (target end-state achieved)
- `[~]` In Progress (partially implemented)
- `[ ]` Not Started / not enough implemented for target end-state

1. `[x]` Identity, RBAC, and Security
2. `[x]` Organization and Settings
3. `[x]` Master Data Management
4. `[ ]` CRM and Pre-Sales
5. `[ ]` Sales (O2C)
6. `[x]` Procurement (P2P)
7. `[x]` Inventory and Store
8. `[x]` Project Management (commercial + execution)
9. `[ ]` Engineering and Site Operations
10. `[x]` Expense Management
11. `[x]` Employee Wallet and Advances
12. `[x]` HRMS
13. `[x]` Payroll and Compensation
14. `[x]` Finance and Accounting Core
15. `[x]` Treasury and Banking
16. `[x]` Approvals Engine
17. `[x]` Audit, Compliance, and Governance
18. `[x]` Reporting and BI
19. `[ ]` Document Management
20. `[ ]` Integrations and Data Ops

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
- Remaining depth now continues under modules `19` and `20`.

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
- `E` Go-Live Readiness + Plan Sync: `[~]` In Progress  
  Completed: production cutover checklist and rollback runbook documented; staging remains deployment source of truth pending monitored production stabilization window.

Latest discrepancy baseline (`docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md`):
- Open: `CRITICAL 0`, `HIGH 0`, `MEDIUM 0`, `LOW 0`.
- Closure status: implemented-module fast-track discrepancy burn-down is complete for current staging baseline; remaining work is production monitored rollout and module `19`/`20` expansion.

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

**Completed target end-state modules right now:** Employee Wallet and Advances (`11`), HRMS (`12`), Payroll and Compensation (`13`), Finance and Accounting Core (`14`), Treasury and Banking (`15`) (`[x]` = 5).  
Reason: core employee lifecycle (wallet/advances + attendance + leave + payroll policy operations), accounting backbone controls (double-entry posting + period close controls + reconciliation checks), and treasury lifecycle (accounts + cash reporting + reconciliation operations) are implemented in locked baseline flow.

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

#### Phase C — QA + Controlled Release `[~]`
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
- Phase C status: `In Progress (targeted staging e2e passed; full owner-critical matrix and reconciliation signoff pending)`
- Evidence files:
  - `docs/IMPLEMENTATION_REPORT_2026-03-02.md`
  - `docs/STAGING_DEEP_AUDIT_2026-03-02.md`
