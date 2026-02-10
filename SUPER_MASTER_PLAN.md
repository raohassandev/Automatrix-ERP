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

### RB2 — RBAC & data exposure sweep

- Every API route must have explicit permission checks.
- Audit log endpoint must be permission protected.
- Export endpoints must be permission gated + audited.

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

## 10) “Codex economical mode” rules (to prevent token burn)

- Before coding: 10-line plan + list files to touch.
- Max 3 files changed per task unless explicitly approved.
- No repo-wide refactors without a ticket.
- If missing context, request 1–3 specific files, do not scan.

---

## 11) ROADMAP (High level)

Phase 1: Purchasing + Inventory + Controls + truthful reporting
Phase 2: Accounting backbone (COA/GL/Journals + bank recon + taxes)
Phase 3: HR/Payroll maturity
Phase 4: Projects/Tasks

---
