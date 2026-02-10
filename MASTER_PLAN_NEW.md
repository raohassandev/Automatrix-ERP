# AutoMatrix ERP — MASTER PLAN (Rewrite) — Modular, Project-Centric ERP

**Owner:** Automatrix (Klausky Workshop)
**Product:** AutoMatrix ERP (Web)
**Goal:** Turn the current working prototype into a **professional, modular ERP** for a small business with **ERP-grade correctness**, and a clear path for expansion.

---

## 1) North Star

### 1.1 What “Professional ERP” means for us

A professional ERP is not “many screens.” It is:

- **Correct workflows** (documents, lifecycle, approvals, posting rules)
- **Data integrity** (no silent edits, traceability, constraints)
- **Operational fit** (the system matches how we buy/sell/store/pay)
- **Auditability** (who/when/why for every critical change)
- **Scalability** (modules can expand without breaking others)

### 1.2 Product stance

- **Modular monolith** (single app, strong module boundaries)
- **Project-centric operations** (projects are first-class; costing/profit later)
- **Strict RBAC + approvals + audit trails**
- **No “magic edits” in finance/inventory** (every change must be explainable)

---

## 2) Core Concepts (Non-Negotiables)

### 2.1 Module boundaries (domain ownership)

Each module owns its data + business rules. Other modules can reference it but must not mutate it directly.

- **Master Data:** Items, Parties (Customers/Vendors), Employees, Warehouses, UOM, Taxes, Number Series
- **Purchasing:** RFQ/PO/GRN/Vendor Bill/Payment
- **Sales:** Quotation/Sales Order/Delivery/Invoice/Receipt
- **Inventory:** Stock ledger, transfers, adjustments, valuation method
- **Accounting:** COA, Journal, GL, AR/AP, period close
- **HR & Payroll:** Employees, attendance (later), payroll, advances
- **Projects (later):** budgets, project costing, timesheets
- **Admin:** RBAC, approvals, audit, settings, templates

### 2.2 Document lifecycle standard (applies to ALL documents)

Every business document must follow a consistent lifecycle:

`DRAFT → SUBMITTED → APPROVED → POSTED → LOCKED / CANCELLED`

Rules:

- **Only DRAFT is freely editable**
- **After APPROVED:** edits require either explicit “re-open” policy or reversal docs
- **After POSTED:** never mutate value-bearing lines; use reversal/adjustment documents
- **LOCKED:** period-close locks accounting & inventory movements

### 2.3 Posting model (professional spine)

All “real-world transactions” must generate **postings**:

- Inventory postings → **InventoryLedger**
- Accounting postings → **JournalLines / GL**
- All postings must store: `sourceType`, `sourceId`, `postedBy`, `postedAt`

**Traceability requirement:** From any ledger line, you must reach the originating document.

---

## 3) What’s Wrong Today (Prototype Gaps We Must Fix)

This is the reason for the rewrite plan direction (not a blame list).

### 3.1 “Single-line” transaction design

Current patterns (example: Expense → Inventory) support one-line flows.
Real life requires multi-line documents:

- One vendor bill/payment can contain **multiple items + services + taxes + freight**
- One receipt can contain **multiple line items** (and partial receipts)

### 3.2 Incomplete “document chains”

You have pieces (expenses, invoices, PO/GRN) but not full professional chains:

- Purchases must go: **PO → GRN → Vendor Bill → Payment**
- Sales must go: **Quotation → Sales Order → Delivery → Invoice → Receipt**
- Accounting must reconcile AR/AP/Inventory to GL.

### 3.3 Editing + validation inconsistencies

- Finance/inventory cannot allow informal edits without lifecycle rules, approvals, validations.
- We need consistent UI patterns: forms, line grids, totals, validation, state badges.

---

## 4) Modules and Minimum Viable Professional Scope

### 4.1 Phase 1 (Operations-Ready) — MUST SHIP FIRST

Goal: Make the ERP usable daily with correct procurement/sales/inventory flows.

**A) Purchasing (core)**
Documents:

- Vendor (master)
- Purchase Order (multi-line)
- Goods Receipt Note (multi-line, can be partial vs PO)
- Vendor Bill (multi-line; can reference GRN or direct)
- Vendor Payment (can be partial; allocates to bills)

Outputs:

- InventoryLedger (on GRN)
- AP subledger entries (on Vendor Bill)
- Payment allocation records (on Payment)

**B) Sales (core)**
Documents:

- Customer (master)
- Quotation (multi-line)
- Sales Order (multi-line)
- Delivery/Dispatch (multi-line, partial)
- Sales Invoice (multi-line)
- Customer Receipt (partial allowed; allocates to invoices)

Outputs:

- AR subledger entries (on Invoice)
- InventoryLedger (on Delivery if stock-based)
- Payment allocation records (on Receipt)

**C) Inventory (core)**
Features:

- Item master (UOM, category, reorder level)
- Warehouses (even if 1 initially)
- Stock Ledger (all movements)
- Transfers, adjustments, stock take (Phase 1.5 if needed)
- Valuation method (simple avg-cost initially)

**D) Approvals + Audit (enforced everywhere critical)**

- Standard approval policies per document type
- Audit log for create/edit/state-change/post/delete attempts
- Permission gates in UI + API for every action

**E) Reporting (basic but truthful)**

- Inventory on-hand by item/warehouse
- Purchase & sales summaries
- Project-wise cost/revenue (based on linked documents)
- AR/AP aging (even if simple)

### 4.2 Phase 2 (Accounting Backbone) — professional finance

Goal: Replace “finance-lite” with real accounting structure.

- Chart of Accounts (COA)
- Journals + Journal Lines
- General Ledger
- AR/AP control accounts (reconcile subledgers)
- Bank accounts + bank reconciliation (Phase 2.5)
- Taxes (VAT/WHT placeholders now, full later)
- Period close / locking rules

### 4.3 Phase 3 (HR/Payroll maturity)

- Employee master improvements
- Payroll engine rules (earnings/deductions)
- Salary advances, incentives, commissions (with policy)
- Payslips + payroll posting to accounting

### 4.4 Phase 4 (Projects & Tasks)

- Project budgets, BOQ (if needed), costing model
- Timesheets
- Task management workflows (assignments, SLA, checklists)

---

## 5) Cross-Cutting Standards (Applies To All Modules)

### 5.1 Data integrity rules

- No negative stock unless explicitly allowed by setting
- Unique document numbers per series, per company
- Strict foreign key integrity (no orphan ledger lines)
- Soft delete only where legally acceptable; otherwise cancel/reverse

### 5.2 UX/UI standards (ERP-grade forms)

- Finance/inventory documents use **line-item grid** (add/remove rows)
- Visible totals (line totals + grand total)
- State badge always visible (Draft/Approved/Posted/etc.)
- Attachments and notes supported on all critical docs
- No prompt-based edits for finance/inventory

### 5.3 Security standards

- RBAC is enforced at API + UI
- Scope rules: project assignments / department scope where applicable
- All sensitive exports require explicit permission and are logged

### 5.4 Testing requirements (minimum)

- Service-level unit tests for posting rules
- Integration tests for “document → postings”
- Playwright flows for:
  - Create PO → GRN → Vendor Bill → Payment
  - Create SO → Delivery → Invoice → Receipt
  - Inventory movement and stock correctness

---

## 6) Definition of Done (DoD) — when a module is “Professional-Ready”

A module is DONE only if:

- Document lifecycle implemented + enforced
- Multi-line forms implemented where required
- Posting rules implemented + traceable (`sourceType/sourceId`)
- RBAC + approvals + audit logs applied
- Validation + edge-case handling
- Reports match ledgers (no hidden logic)
- Tests exist for critical flows
- No unsafe editing paths remain

---

## 7) Migration / Compatibility Strategy

We will not “randomly refactor.” We will migrate by controlled steps:

- Introduce new document models alongside old (if needed)
- Provide data migration scripts where necessary
- Freeze/lock old flows once new flows replace them
- Keep audit logs across migrations

---

## 8) Roadmap Milestones (Outcome-Based)

### M0 — Planning Reset (this doc + SOP finalized)

- Confirm module boundaries
- Confirm document lists + lifecycle + posting rules
- Confirm Phase 1 scope

### M1 — Purchasing + Inventory spine live

- PO → GRN → Vendor Bill → Payment
- Inventory ledger correct
- Basic AP aging

### M2 — Sales spine live

- Quotation → SO → Delivery → Invoice → Receipt
- Inventory ledger correct
- Basic AR aging

### M3 — Accounting backbone starts

- COA + Journal + GL
- Subledger reconciliation

---

## 9) How this plan connects to SOP

- **MASTER_PLAN.md** = Vision + modules + workflows + roadmap
- **SOP.md** = execution rules (do/don’t), coding standards, test gates, cost controls for Codex
- All development tasks must reference a Phase + Document + DoD checklist item.

---

## 10) Immediate next actions (very first tasks)

1. Define document schemas for Phase 1 (Purchasing + Sales + Inventory)
2. Define standard posting interface (`sourceType/sourceId`, posting transaction wrapper)
3. Replace single-line Expense→Inventory pattern with proper multi-line purchasing flow
4. Standardize UI document shell (header + lines grid + totals + lifecycle actions)

---

**End.**

---

## Appendix A — Phase 1 Planner Defaults (LOCKED ✅)

These defaults are locked to avoid mid-build reinterpretation and cost creep. Any change must be logged as a plan revision (e.g., `MASTER_PLAN_NEW.md` v1.1) with migration notes.

### A.1 Currency + exchange (Phase 1)
- Single currency only: **PKR**
- No FX in Phase 1
- Store all money as **Decimal** (Prisma Decimal); format as PKR everywhere

### A.2 Time + dates
- Business timezone: **Asia/Karachi**
- Document date vs Posting date: both exist
  - `documentDate`: user-entered (paper trail)
  - `postingDate`: affects ledgers (inventory / AR/AP allocations)
- Back-dating policy:
  - Default: blocked for normal users
  - Allowed only for Finance + Owner/CEO, permission-gated, **reason required**, audited
  - Once `POSTED`, no date changes (use reversal docs)

### A.3 Parties model
- Use single **Party** master with roles: `CUSTOMER` / `VENDOR` / `BOTH`
- Avoid separate Customer/Vendor tables in Phase 1

### A.4 Warehouse + inventory reservation
- No reservation in Phase 1
- Stock reduces only on **Delivery**
- Sales Order does not reserve stock (Phase 1.5 if needed)

### A.5 Payments/receipts + company accounts
- Include Company Accounts list in Phase 1 (minimal):
  - `CompanyAccount` (Cash + Banks)
- Every payment/receipt must select Paid/Received via account (for reporting)
- Methods are labels only (Cash/Bank/Online/Cheque), not GL

### A.6 Credit terms (AR/AP aging)
- Default terms:
  - Customers: Net 30
  - Vendors: Net 30
- Overdue definition:
  - overdue if `today > invoiceDate + termsDays`
  - use **postingDate** for ledger consistency when it differs

### A.7 Attachments policy
- Phase 1: URL-only attachments (keep current approach)
- Allowed types: `pdf`, `jpg`, `jpeg`, `png`, `xlsx`, `docx`
- Max size: enforce in UI (soft limit)
- Store metadata fields: `fileName`, `mimeType`, `sizeBytes`, `url`
- Upload storage (S3/local) is Phase 2+

### A.8 Auth + user provisioning
- Admin/Owner-only user creation (no public signup in production)
- Password reset:
  - Admin generates temporary password
  - User must change password on first login
  - All actions are audited

---

## Appendix B — Production & Ops Defaults (LOCKED)

These defaults are locked for Phase 1 to prevent infra/security scope creep. Any change requires explicit version bump (V1 → V1.1).

### B1) Environments + release flow
- Environments:
  - `dev` (local)
  - `staging` (Hostinger VPS)
  - `prod` (Hostinger VPS)
- Branch mapping:
  - `dev` → staging
  - `main` → prod
- Staging runs production build settings:
  - `NODE_ENV=production`
  - Separate database from production

### B2) Deployment model (Hostinger VPS)
- Reverse proxy: Nginx (HTTPS) → app on `127.0.0.1:3030`
- Process manager: PM2
- Ports:
  - Public: 80/443 only
  - App binds to localhost only
- Locked deploy steps (staging + prod):
  1. Pull code for the target branch
  2. `pnpm install --frozen-lockfile`
  3. `pnpm security:check`
  4. `pnpm build:optimized` (or `pnpm build`)
  5. DB backup (verified file exists)
  6. `prisma migrate deploy` (prod/staging only)
  7. PM2 restart/reload
  8. Smoke test (health endpoint + login)

### B3) Database + migrations (real data rules)
- Postgres hosted on the same VPS initially
- Postgres must bind to localhost (not public)
- Migration rules:
  - Production/staging: **ONLY** `prisma migrate deploy`
  - Never use `prisma db push` on staging/prod
  - Never delete migration history in prod
- Before every migration:
  - automatic backup + verify backup file exists and is non-empty

### B4) Backup/restore + disaster recovery
- Nightly automated backups:
  - `pg_dump` compressed
  - Retention: 30 days
- Offsite storage is mandatory:
  - Default destination: Backblaze B2 (or equivalent)
  - Backups stored on the same VPS do not count as “offsite”
- Monthly restore drill:
  - restore latest backup into staging DB
  - confirm app can boot and key reports render

### B5) Security hardening (explicit)
- Public registration disabled in production:
  - `/api/register` must be admin-only or disabled
- Brute-force protection:
  - Rate-limit credentials login
  - Basic lockout/backoff after repeated failed attempts
- Secrets management:
  - Env only (never committed):
    - `DATABASE_URL`
    - `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
    - `NEXTAUTH_URL`
- Firewall:
  - Allow only 22/80/443
  - DB not exposed publicly
- SSH:
  - SSH keys only, no password auth
  - Max 2 admins with SSH access

### B6) Monitoring + logging
- PM2 logs enabled + logrotate
- Disk alert threshold configured (to prevent log/backup filling disk)
- Health endpoint:
  - `/api/health` returns status + db connectivity
  - Used by UptimeRobot (or similar)
- Optional (recommended):
  - Sentry error tracking (client + server)

### B7) Data governance (ERP-grade)
- Audit log retention: minimum 2 years
- No hard delete for posted documents:
  - cancellation/reversal is the allowed mechanism
- Export governance:
  - export permissions are explicit
  - exports are logged (who/when/what)
- PII handling:
  - sensitive fields (CNIC/addresses) view/export only for authorized roles
  - all access is auditable
