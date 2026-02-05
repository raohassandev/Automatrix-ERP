# Audit V1 — AutoMatrix ERP (C&I Engineering)

**Auditor Identity:** Codex (OpenAI), acting as engineering agent on this repo  
**Date:** 2026-02-04  
**Scope:** Web app (Next.js), API routes, RBAC, core workflows, UX, and test coverage.  
**Method:** Static code review of pages, API routes, RBAC map, and shared components.  

---

## Executive Summary
The system is **not release‑ready** for employee use. Key blockers are:
- **CRUD completeness gaps** (many modules use quick prompt edits instead of full edit forms).
- **Role coverage gaps** (Store role not implemented; Procurement missing own‑wallet view).
- **Employee self‑service dashboard missing** (wallet + approvals + balances).
- **UI/UX inconsistencies** (mobile actions vs desktop, uneven filtering/search).
- **Test coverage far below 100%** (only a few unit tests).

---

## Feature Readiness (High Level)

### 1) Expenses
**Exists:** List, filters, export, submit, approval flow, wallet hold logic.  
**Gaps:**
- Desktop table has **no edit/delete actions** (only mobile has actions).  
  - Evidence: `src/app/expenses/page.tsx`  
- Edit flow mostly via **QuickEdit prompt**, not full edit form.  
  - Evidence: `src/components/TableActions.tsx`  
**Risk:** Users cannot reliably correct mistakes or add full data on edits.

### 2) Income
**Exists:** CRUD endpoints, approvals, export.  
**Gaps:** Edit UI depends on quick edit pattern; no structured edit form.  
**Risk:** Incomplete data correction; inconsistent UX.

### 3) Projects
**Exists:** Create + edit dialog with prefilled data; financial summary.  
**Gaps:** Limited fields in edit dialog; no advanced project workflow (milestones, tasks).  
**Risk:** Some ERP expectations unmet but functional for v1.

### 4) Clients
**Exists:** Create, list, search, delete.  
**Gaps:** Editing uses QuickEdit prompt only; contact editing not full CRUD.  
**Risk:** Client data cannot be accurately maintained.

### 5) Inventory
**Exists:** List, search, stock in/out, allocations, cost/selling visibility.  
**Gaps:** Edit uses QuickEdit prompt; no structured inventory edit form.  
**Risk:** Incomplete item management and audit accuracy.

### 6) Employee Wallet
**Exists:** Ledger, credit/debit, wallet hold during approvals.  
**Gaps:** **Employee self dashboard missing** for wallet + approvals + balance + salary history.  
**Risk:** Employees cannot self‑serve; workflow becomes admin‑heavy.

### 7) Approvals
**Exists:** Approvals list + permission gates + audit logging.  
**Gaps:** No standardized policy editor for approval thresholds.  
**Risk:** Hardcoded logic reduces flexibility.

### 8) Reports
**Exists:** Summary reports and module reports (expenses, inventory, wallets, projects).  
**Gaps:** No per‑role tailored reporting, no drill‑downs by team/department.  

---

## Role & Permission Coverage
**Exists:** Role map with permission checks enforced in API and UI.  
**Gaps:**
- **Store role missing** (required in SOP).  
- **Procurement role lacks `employees.view_own`**, so cannot see own wallet ledger.  
- Role CRUD not available (roles are hardcoded).  
**Evidence:** `src/lib/permissions.ts`, `src/app/admin/users/page.tsx`

---

## UX / UI Consistency Issues
- Actions available on mobile but not desktop in some modules (e.g., Expenses).  
  - Evidence: `src/app/expenses/page.tsx`
- Search/filter query param names are inconsistent across pages (`q`, `search`, etc.).  
  - Evidence: `src/app/clients/page.tsx`, `src/app/inventory/page.tsx`
- Edit pattern inconsistent (dialog vs prompt).  
  - Evidence: `src/components/TableActions.tsx`, `src/components/ProjectsTable.tsx`

---

## Data Integrity & Audit
**Strengths:** Audit logging is present in most APIs.  
**Gaps:**
- Some data flows rely on implicit UI behavior (e.g., QuickEdit prompts).  
- No centralized validation policy for cross‑module constraints (e.g., project required on all expenses for company policy).  

---

## Security Review (High Level)
**Exists:** API permission checks via RBAC.  
**Gaps:**
- Category GET allows unauthenticated access for basic lists.  
  - Evidence: `src/app/api/categories/route.ts`
- No formal security hardening checklist (rate limiting, strict input validation at edge, etc.).  

---

## Test Coverage
**Status:** Low.  
**Evidence:** Only a handful of unit tests in `src/lib/__tests__/*`.  
**Missing:** Integration tests for critical flows (expense submit/approve, inventory adjust, wallet ledger, roles).

---

## Code Quality / Modularity
**Strengths:**
- Shared components exist (SearchInput, PaginationControls, QuerySelect).
- Consistent formatting and standard Next.js structure.

**Gaps:**
- CRUD edit paths often use prompt‑based edits (non‑professional UX).
- Business rules sometimes enforced in UI but not always in API for all edges.
- Role/permission model is hardcoded and not admin‑configurable.

---

## Expansion Readiness (Future Goals)
**Needs for future scale:**
- Role management CRUD UI.
- Employee self‑service dashboard.
- Standardized workflow for approvals and thresholds.
- Inventory: link purchase + usage + sales price to project profitability.
- Reporting: drill‑down by department, project, client, and date range.

---

## Release Readiness Score (V1)
- **Functional Completeness:** 55%  
- **Role & Access:** 60%  
- **UX & Usability:** 45%  
- **Data Integrity:** 65%  
- **Test Coverage:** 10%  
**Overall:** **Not release ready**

---

## Priority Fix List (Order)
1) Replace QuickEdit prompts with full edit dialogs on all major modules.  
2) Add Employee Self Dashboard (wallet + approvals + balances + status).  
3) Add Store role and fix Procurement `employees.view_own`.  
4) Normalize list filtering/search params and actions across desktop/mobile.  
5) Implement test coverage for core workflows.  

---

## Notes for Cross‑Audit
This audit is based on static code review, not runtime testing.  
If you want a runtime audit (UI behavior + API responses), I can run targeted tests and produce an addendum.

---

# Cross‑Audit Addendum (Rovo Dev)

**Auditor Identity:** Rovo Dev (independent cross-check)

## 1) Corrections / disagreements with V1

### 1.1 Sidebar is permission-aware (partially mitigates UI exposure)
The V1 report implies broad UI exposure. The sidebar navigation is already permission gated per item:
- Evidence: `src/components/Sidebar.tsx:31-64` each item includes `permissions: [...]`.

**However**: sidebar gating does not replace server-side enforcement.

### 1.2 Dashboard “0 totals” can be caused by dev-bypass identity mismatch
In development, the credentials bypass user id was not guaranteed to exist in DB. Many endpoints scope by `submittedById/addedById`, which can yield empty views and 0 totals for that dev user.
- Evidence (scoping patterns): `src/app/api/expenses/route.ts` + `src/app/income/page.tsx` apply “own” filters by userId.
- Fix pattern recommendation: ensure dev-bypass user is provisioned or ensure CEO scope is used.

## 2) High-risk security/access-control gaps (release blockers)

### 2.1 Field/column-level access control is not implemented
RBAC exists at feature/action level, but responses are not redacted per-field. If you require “column-level deep” access, you need DTO/redaction on server.
- Evidence: API list endpoints return full objects with no per-field filtering.

### 2.2 Attachments access control needs strict parent-authorization
Attachment endpoints are commonly a data leak point. Validate:
- attachment belongs to a parent record
- user can access that parent
- Evidence to review: `src/app/api/attachments/route.ts`, `src/app/api/attachments/[id]/route.ts`.

### 2.3 Dashboard API must be permission + scope aware
Dashboards often leak organization-wide totals. Validate `src/app/api/dashboard/route.ts` requires an explicit permission and applies scope filtering.

### 2.4 Categories endpoint unauthenticated access
V1 flagged categories GET. Confirm whether it is intended public. If not, require auth.
- Evidence: `src/app/api/categories/route.ts` (GET auth check).

## 3) UX gaps confirmed + additional observations

### 3.1 “QuickEdit prompt” is not audit-safe for finance records
V1 is correct: prompt-based editing is risky for Expenses/Income/Inventory and undermines data quality.
Recommendation:
- move to structured edit dialogs with validation + audit fields.

### 3.2 Project scale (100+ projects) will break dropdown UX
Project selection should be async search + recent/favorites.
- Evidence: multiple forms rely on project selectors; ensure async combobox exists and is used consistently.

## 4) Test coverage reality + recommendations

### 4.1 Unit tests are minimal (confirmed)
There are only a small number of tests under `src/lib/__tests__/`.
Recommendation:
- increase business-logic unit tests for validation schemas, permission resolution, approvals thresholds, wallet invariants.
- add a Playwright “smoke all pages” test for navigation regressions.

### 4.2 Require evidence-based coverage reporting
Any “coverage improved” claim must include:
- `pnpm test --coverage` output and coverage summary artifact.

## 5) Release readiness: additional blockers

### 5.1 Dev bypass credentials are a security foot-gun
Hardcoded dev credentials are fine only if strictly gated to development.
Recommendation:
- Ensure bypass path is impossible in production builds.

### 5.2 API vs UI permission parity must be audited
Even with sidebar gating, verify every API route enforces permissions.
Method:
- grep all API routes for auth/permission checks
- produce a matrix: route → required permission → enforced?

---

## Codex re-audit request (actionable checklist)
Codex should re-check the codebase focusing on:
1) API permission enforcement parity for all routes (especially dashboard, attachments, exports).
2) Any unauthenticated endpoints (categories, public lists).
3) Data scoping correctness (own/team/all) across Expenses/Income/Employees.
4) Column-level security feasibility (DTO/redaction plan).
5) Replace QuickEdit patterns with structured edit forms for finance-critical modules.

---

# Codex Re‑Audit Prompt (V2, strict + role-aware)

Paste the following prompt into Codex. It is designed to force a **deep, evidence-based audit** and produce a fix backlog that is verifiable.

## Mandatory constraints
1) Read `AUDIT_V1.md` fully, including **“Cross‑Audit Addendum (Rovo Dev)”**.
2) You must re-audit by inspecting real files. No guessing.
3) **No claim without evidence.** Every claim must include either:
   - `filePath:lineRange` + snippet, OR
   - a command + output.
4) Avoid vague language (“mixed quality”, “looks fine”) without citations.
5) Output must be structured exactly as below.

## Deliverable
Append a new section to `AUDIT_V1.md` titled:

## Audit V2 — Codex Re‑Audit (Evidence‑Based)

### 1) Architecture & Code Quality (Reuse/Modularity) — Evidence Required
1.1 Create a table for these modules:
- Dashboard, Expenses, Income, Projects, Inventory, Approvals, Notifications, Reports, Audit Log, Settings, Users/Admin

Columns:
- Has reusable components? (Y/N)
- Duplication hotspots (>=3 file paths)
- State/data-fetch pattern (where/how)
- Form pattern (shared vs duplicated)
- What should be extracted (component/service/hook)
- Evidence (`path:lineRange`)

1.2 Bad pattern inventory with counts + top matches:
- duplicated `fetch('/api/...')`
- duplicated table rendering
- duplicated date/amount formatting (not using shared util)
- prompt-based editing (“QuickEdit”)
- permission checks duplicated/inconsistent

### 2) CRUD Completeness (business critical)
For: Expenses, Income, Projects, Inventory, Clients, Invoices, Quotations, Employees
Create a table:
- Create (UI+API)
- Read/List
- Update/Edit (must specify “QuickEdit prompt” vs “structured form”)
- Delete
- Validation parity (UI vs API)
- Evidence (`path:lineRange`)

### 3) Security & RBAC parity (API vs UI)
3.1 Build an **API permission parity matrix** for every `src/app/api/**/route.ts`:
Columns:
- Route
- Auth check present?
- Permission(s) enforced?
- Scope logic (own/team/all)
- Sensitive fields returned?
- Risk rating
- Evidence (`path:lineRange`)

Prioritize: dashboard, attachments, exports, audit, reports, wallet, employees.

3.2 List unauthenticated endpoints (if any), whether intended, and fix recommendation.

3.3 Attachments authorization: prove whether attachment access is tied to parent record permission.

### 4) Role-by-role workflow matrix (release readiness)
Define the expected workflows per role and verify (UI + API + permissions) with evidence.

**Roles to evaluate (minimum):**
- Owner/CEO
- CFO/Finance Manager
- Manager/Project Manager
- Procurement
- Store/Warehouse
- Sales
- HR
- Engineering/Staff
- Auditor/Read-only

For each role, fill a table:
- Can login
- Can view dashboard (scope)
- Expenses: create / edit / submit / approve / mark paid / export
- Income: create / edit / approve / export
- Projects: create / edit / assigned view / financials
- Inventory: view / adjust / ledger export
- Employees: view own / team / all; wallet view/edit
- Reports: own/team/all
- Audit log access

For each cell: mark ✅/❌ and cite **the permission constant + enforcement location**.

### 5) Data integrity invariants
List business invariants and whether enforced in API and UI with evidence:
- amount non-negative
- required project rules
- wallet cannot go negative / walletHold rules
- approval levels/thresholds
- mark-as-paid logic consistency

### 6) Testing reality check (no marketing)
- List all existing tests and what they assert.
- If you claim coverage, paste `pnpm test --coverage` output.
- Propose a test plan (unit first for business logic, then integration, then Playwright smoke).

### 7) Prioritized backlog
Provide Critical/High/Medium items. Each item must include:
- impact
- exact files
- fix steps
- evidence snippet(s)

## Hard rule
Do not claim “production ready” or give scores unless you define a rubric and evidence per item.

## Audit V2 — Codex Re‑Audit (Evidence‑Based)

### 1) Architecture & Code Quality (Reuse/Modularity) — Evidence Required

#### 1.1 Module table
| Module | Has reusable components? | Duplication hotspots (>=3 file paths) | State/data-fetch pattern (where/how) | Form pattern (shared vs duplicated) | What should be extracted (component/service/hook) | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Y [E1] | Summary cards repeated across Dashboard/Reports/Expense Report [E2][E3][E4] | Server component; auth + dashboard data helpers [E5] | No forms; display-only cards/charts [E6] | Extract `SummaryCard` component for repeated card markup [E2][E3][E4] | E1 `src/app/dashboard/page.tsx:1-14` “import … IncomeExpenseChart … ExpenseByCategoryChart … formatMoney”<br>E2 `src/app/dashboard/page.tsx:61-93` “<div className=\"rounded-xl border bg-card p-6 shadow-sm\">” (summary cards)<br>E3 `src/app/reports/page.tsx:70-96` “<div className=\"rounded-xl border bg-card p-6 shadow-sm\">” (summary cards)<br>E4 `src/app/reports/expenses/page.tsx:121-133` “<div className=\"rounded-xl border bg-card p-6 shadow-sm\">” (summary cards)<br>E5 `src/app/dashboard/page.tsx:16-33` “const session = await auth(); … data = await getDashboardDataEnhanced(); … getChartData()”<br>E6 `src/app/dashboard/page.tsx:54-102` “return ( … <IncomeExpenseChart …/> … <WalletBalanceChart …/> )” |
| Expenses | Y [E1] | Repeated table markup in Expenses/Income/Invoices [E2][E3][E4] | Client `useEffect` fetch `/api/expenses` [E5] | Shared create dialog (FormDialogManager → ExpenseFormDialog) [E6][E7] | Extract list filter bar (DateRangePicker + SearchInput + QuerySelect) [E8][E9][E10] | E1 `src/app/expenses/page.tsx:7-16` “import PaginationControls … SearchInput … DateRangePicker … QuerySelect … PageCreateButton”<br>E2 `src/app/expenses/page.tsx:145-156` “<table className=\"w-full text-sm\">”<br>E3 `src/app/income/page.tsx:121-131` “<table className=\"w-full text-sm\">”<br>E4 `src/app/invoices/page.tsx:151-163` “<table className=\"w-full text-sm\">”<br>E5 `src/app/expenses/page.tsx:77-84` “const res = await fetch(`/api/expenses?…`); … setExpenses …”<br>E6 `src/app/expenses/page.tsx:135-137` “<PageCreateButton label=\"Submit Expense\" formType=\"expense\" />”<br>E7 `src/components/FormDialogManager.tsx:26-33` “<ExpenseFormDialog … />”<br>E8 `src/app/expenses/page.tsx:99-127` “<DateRangePicker /> … <SearchInput …/> … <QuerySelect …/>”<br>E9 `src/app/income/page.tsx:93-105` “<DateRangePicker /> … <SearchInput …/> … <QuerySelect …/>”<br>E10 `src/app/notifications/page.tsx:93-104` “<SearchInput …/> … <QuerySelect …/>” |
| Income | Y [E1] | Repeated table markup in Income/Expenses/Invoices [E2][E3][E4] | Server component; Prisma `findMany` + `count` [E5] | Shared create dialog (FormDialogManager → IncomeFormDialog) [E6][E7] | Extract shared list pagination/scaffold (search + page/take/skip) [E8][E9][E10] | E1 `src/app/income/page.tsx:7-12` “import SearchInput … PaginationControls … QuerySelect … DateRangePicker”<br>E2 `src/app/income/page.tsx:121-131` “<table className=\"w-full text-sm\">”<br>E3 `src/app/expenses/page.tsx:145-156` “<table className=\"w-full text-sm\">”<br>E4 `src/app/invoices/page.tsx:151-163` “<table className=\"w-full text-sm\">”<br>E5 `src/app/income/page.tsx:62-70` “prisma.income.findMany … prisma.income.count”<br>E6 `src/components/FormDialogManager.tsx:33-36` “<IncomeFormDialog … />”<br>E7 `src/components/IncomeFormDialog.tsx:88-100` “<FormDialog …> … <form …>”<br>E8 `src/app/income/page.tsx:33-39` “page … take … skip …”<br>E9 `src/app/projects/page.tsx:35-39` “page … take … skip …”<br>E10 `src/app/inventory/page.tsx:37-41` “page … take … skip …” |
| Projects | Y [E1] | Repeated table markup in Projects/Inventory/Employees [E2][E3][E4] | Server component; Prisma `findMany` [E5] | Structured edit dialog (ProjectFormDialog) [E6][E7] | Extract shared table action row (Edit/Delete) [E8][E9][E10] | E1 `src/app/projects/page.tsx:5-9` “import SearchInput … PaginationControls … ProjectsTable … PageCreateButton”<br>E2 `src/components/ProjectsTable.tsx:42-79` “<table className=\"w-full text-sm\">”<br>E3 `src/components/InventoryTable.tsx:42-114` “<table className=\"w-full text-sm\">”<br>E4 `src/components/EmployeesTable.tsx:55-102` “<table className=\"w-full text-sm\">”<br>E5 `src/app/projects/page.tsx:52-59` “prisma.project.findMany … include: { client: true }”<br>E6 `src/components/ProjectsTable.tsx:117-134` “<ProjectFormDialog … initialData=…>”<br>E7 `src/components/ProjectFormDialog.tsx:70-94` “const res = await fetch(…/api/projects…)”<br>E8 `src/components/ProjectsTable.tsx:63-73` “<Button …>Edit</Button> … <DeleteButton …/>”<br>E9 `src/components/EmployeesTable.tsx:81-96` “<Button …>Wallet</Button> … <QuickEditButton …/> <DeleteButton …/>”<br>E10 `src/components/InventoryTable.tsx:78-108` “<Button …>Stock In/Out</Button> … <QuickEditButton …/> <DeleteButton …/>” |
| Inventory | Y [E1] | QuickEdit pattern repeated (Inventory/Employees/Clients) [E2][E3][E4] | Server component; Prisma `findMany` [E5] | Create uses InventoryFormDialog; edit uses QuickEdit [E6][E7] | Replace QuickEdit prompt with structured edit dialog [E8] | E1 `src/app/inventory/page.tsx:4-8` “import InventoryTable … SearchInput … PageCreateButton”<br>E2 `src/components/InventoryTable.tsx:98-106` “<QuickEditButton url={\`/api/inventory/\${item.id}\`} …/>”<br>E3 `src/components/EmployeesTable.tsx:91-95` “<QuickEditButton url={\`/api/employees/\${employee.id}\`} …/>”<br>E4 `src/app/clients/page.tsx:111-115` “<QuickEditButton url={\`/api/clients/\${client.id}\`} …/>”<br>E5 `src/app/inventory/page.tsx:56-59` “prisma.inventoryItem.findMany …”<br>E6 `src/components/InventoryFormDialog.tsx:32-47` “fetch(\"/api/inventory\", …)”<br>E7 `src/components/InventoryTable.tsx:98-106` “QuickEditButton …”<br>E8 `src/components/TableActions.tsx:27-50` “const value = prompt(…) … fetch(url, { method: \"PATCH\" … })” |
| Approvals | Y [E1] | Date formatting duplication (ApprovalQueue/Expenses/Reports) [E2][E3][E4] | Server component; `getPendingApprovalsForUser` + Prisma [E5] | In-table actions in ApprovalQueue (no form dialog) [E6] | Extract shared date-format helper [E2][E3][E4] | E1 `src/app/approvals/page.tsx:5-8` “import ApprovalQueue …”<br>E2 `src/components/ApprovalQueue.tsx:291-293` “{new Date(expense.date).toLocaleDateString()}”<br>E3 `src/app/expenses/page.tsx:163-165` “new Date(expense.date).toLocaleDateString()”<br>E4 `src/app/reports/expenses/page.tsx:171-172` “new Date(exp.date).toLocaleDateString()”<br>E5 `src/app/approvals/page.tsx:61-75` “const pendingApprovals = await getPendingApprovalsForUser(…) …”<br>E6 `src/components/ApprovalQueue.tsx:260-303` “<table …> … <tr …> …” |
| Notifications | Y [E1] | QuickEdit/table pattern repeated (Notifications/Clients/Invoices) [E2][E3][E4] | Server component; Prisma `findMany` [E5] | NotificationForm uses direct fetch (not FormDialog) [E6] | Extract shared form input/submit pattern (NotificationForm/RoleAssignForm/AttachmentForm) [E6][E7][E8] | E1 `src/app/notifications/page.tsx:7-9` “import SearchInput … PaginationControls … QuerySelect”<br>E2 `src/app/notifications/page.tsx:112-137` “<table …> … <QuickEditButton …/>”<br>E3 `src/app/clients/page.tsx:90-117` “<table …> … <QuickEditButton …/>”<br>E4 `src/app/invoices/page.tsx:151-183` “<table …> … <QuickEditButton …/>”<br>E5 `src/app/notifications/page.tsx:63-70` “prisma.notification.findMany …”<br>E6 `src/components/NotificationForm.tsx:15-21` “await fetch(\"/api/notifications\", …)”<br>E7 `src/components/RoleAssignForm.tsx:15-22` “await fetch(\"/api/users/role\", …)”<br>E8 `src/components/AttachmentForm.tsx:17-25` “await fetch(\"/api/attachments\", …)” |
| Reports | Y [E1] | Summary cards repeated (Reports/Dashboard/Expense Report) [E2][E3][E4] | Server component; Prisma aggregates [E5] | No form; display-only summary + links [E6] | Extract `SummaryCard` component for reused card markup [E2][E3][E4] | E1 `src/app/reports/page.tsx:5-7` “import { requirePermission } … ReportExporter”<br>E2 `src/app/reports/page.tsx:70-96` “<div className=\"rounded-xl border bg-card p-6 shadow-sm\">”<br>E3 `src/app/dashboard/page.tsx:61-93` “<div className=\"rounded-xl border bg-card p-6 shadow-sm\">”<br>E4 `src/app/reports/expenses/page.tsx:121-133` “<div className=\"rounded-xl border bg-card p-6 shadow-sm\">”<br>E5 `src/app/reports/page.tsx:29-40` “prisma.expense.aggregate … prisma.income.aggregate …”<br>E6 `src/app/reports/page.tsx:48-97` “return ( … summary cards … links … )” |
| Audit Log | Y [E1] | Table markup repeated (Audit/Clients/Inventory Ledger) [E2][E3][E4] | Server component; Prisma `auditLog.findMany` [E5] | No form; display-only table [E6] | Extract generic table component [E2][E3][E4] | E1 `src/app/audit/page.tsx:5-6` “import SearchInput … PaginationControls”<br>E2 `src/app/audit/page.tsx:84-105` “<table className=\"w-full text-sm\">”<br>E3 `src/app/clients/page.tsx:90-123` “<table className=\"w-full text-sm\">”<br>E4 `src/app/inventory/ledger/page.tsx:136-168` “<table className=\"w-full text-sm\">”<br>E5 `src/app/audit/page.tsx:50-57` “prisma.auditLog.findMany …”<br>E6 `src/app/audit/page.tsx:72-105` “return ( … <table …> … )” |
| Settings | Y [E1] | Form input pattern repeated (RoleAssign/Notification/Attachment) [E2][E3][E4] | Server component; auth + permission gate only [E5] | RoleAssignForm (client) [E1][E2] | Extract shared form field group component [E2][E3][E4] | E1 `src/app/settings/page.tsx:24-31` “<RoleAssignForm />”<br>E2 `src/components/RoleAssignForm.tsx:24-45` “<input …/> <select …/>”<br>E3 `src/components/NotificationForm.tsx:24-45` “<input …/> …”<br>E4 `src/components/AttachmentForm.tsx:29-62` “<input …/> …”<br>E5 `src/app/settings/page.tsx:7-15` “const session = await auth(); … requirePermission(…employees.view_all)” |
| Users/Admin | Y [E1] | Table markup repeated (Users/Employees/Clients) [E2][E3][E4] | Server component; Prisma `user.findMany` + `role.findMany` [E5] | UserManagementInterface component (no FormDialog) [E1] | Extract shared stats card/table row components [E6][E2][E3] | E1 `src/app/admin/users/page.tsx:5-7` “import … Badge … UserManagementInterface” and `src/app/admin/users/page.tsx:87-100` “<UserManagementInterface …/>”<br>E2 `src/app/admin/users/page.tsx:106-131` “<table className=\"w-full text-sm\">”<br>E3 `src/components/EmployeesTable.tsx:55-102` “<table className=\"w-full text-sm\">”<br>E4 `src/app/clients/page.tsx:90-123` “<table className=\"w-full text-sm\">”<br>E5 `src/app/admin/users/page.tsx:29-35` “prisma.user.findMany … prisma.role.findMany …”<br>E6 `src/app/admin/users/page.tsx:73-83` “<div className=\"grid …\"> … {roles.map(…)} …” |

#### 1.2 Bad pattern inventory with counts + top matches
- duplicated `fetch("/api…")`: 27 occurrences.
  - Command: `rg -n "fetch\\(\\\"/api" src | wc -l`
    Output: `27`
  - Top matches (sample):
    - `src/components/AttachmentForm.tsx:18-21` “await fetch(\"/api/attachments\", { … })”
    - `src/app/login/page.tsx:55-56` “const res = await fetch(\"/api/auth/providers\");”
    - `src/components/CategoryFormDialog.tsx:41-45` “const res = await fetch(\"/api/categories\", { … })”
- duplicated table rendering (`<table>`): 23 occurrences.
  - Command: `rg -n "<table" src | wc -l`
    Output: `23`
  - Top matches (sample):
    - `src/components/InventoryTable.tsx:42-45` “<table className=\"w-full text-sm\">”
    - `src/components/ProjectsTable.tsx:43-46` “<table className=\"w-full text-sm\">”
    - `src/components/EmployeesTable.tsx:55-58` “<table className=\"w-full text-sm\">”
- duplicated date formatting (`toLocaleDateString`): 29 occurrences.
  - Command: `rg -n "toLocaleDateString" src | wc -l`
    Output: `29`
  - Top matches (sample):
    - `src/lib/dashboard.ts:295-296` “date: new Date(entry.date).toLocaleDateString()”
    - `src/app/expenses/page.tsx:163-165` “new Date(expense.date).toLocaleDateString()”
    - `src/app/reports/expenses/page.tsx:171-172` “new Date(exp.date).toLocaleDateString()”
- prompt-based editing (`QuickEditButton`): 19 occurrences.
  - Command: `rg -n "QuickEditButton" src | wc -l`
    Output: `19`
  - Top matches (sample):
    - `src/components/InventoryTable.tsx:98-106` “<QuickEditButton … />”
    - `src/components/EmployeesTable.tsx:91-95` “<QuickEditButton … />”
    - `src/app/clients/page.tsx:111-115` “<QuickEditButton … />”
- permission checks duplicated (requires manual parity review): 177 occurrences.
  - Command: `rg -n "requirePermission" src | wc -l`
    Output: `177`
  - Top matches (sample):
    - `src/app/employees/page.tsx:22-25` “const canViewAll = await requirePermission(…\"employees.view_all\") …”
    - `src/app/inventory/page.tsx:24-27` “const canView = await requirePermission(…\"inventory.view\") …”
    - `src/app/projects/page.tsx:22-24` “const canViewAll = await requirePermission(…\"projects.view_all\") …”

### 2) CRUD Completeness (business critical)
| Module | Create (UI+API) | Read/List | Update/Edit (QuickEdit vs structured) | Delete | Validation parity (UI vs API) | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Expenses | UI: ExpenseFormDialog via FormDialogManager [E1][E2]; API: POST `/api/expenses` [E3] | UI list fetch `/api/expenses` [E4]; API GET `/api/expenses` [E5] | QuickEdit prompt (mobile actions) [E6][E7]; API PATCH `/api/expenses/[id]` [E8] | UI DeleteButton [E6]; API DELETE `/api/expenses/[id]` [E9] | Partial — UI enforces project required + category limits + inventory checks [E10]; API schema + same checks + receipt threshold [E11][E12] | E1 `src/components/FormDialogManager.tsx:26-33` “<ExpenseFormDialog …/>”<br>E2 `src/components/ExpenseFormDialog.tsx:124-178` “fetch(\"/api/expenses\", …)”<br>E3 `src/app/api/expenses/route.ts:159-178` “const parsed = expenseSchema.safeParse …”<br>E4 `src/app/expenses/page.tsx:77-84` “fetch(`/api/expenses?…`)”<br>E5 `src/app/api/expenses/route.ts:42-149` “export async function GET …”<br>E6 `src/app/expenses/page.tsx:216-223` “<QuickEditButton …/> <DeleteButton …/>”<br>E7 `src/components/TableActions.tsx:27-50` “const value = prompt(…); … fetch(url, { method: \"PATCH\" … })”<br>E8 `src/app/api/expenses/[id]/route.ts:12-166` “export async function PATCH … requirePermission(…\"expenses.edit\") …”<br>E9 `src/app/api/expenses/[id]/route.ts:168-199` “export async function DELETE …”<br>E10 `src/components/ExpenseFormDialog.tsx:130-155` “Project is required … Amount exceeds …”<br>E11 `src/lib/validation.ts:3-19` “amount: z.number().positive() …”<br>E12 `src/app/api/expenses/route.ts:197-235` “Project is required … Receipt required …” |
| Income | UI: IncomeFormDialog [E1][E2]; API: POST `/api/income` [E3] | UI server list (Prisma findMany) [E4]; API GET `/api/income` [E5] | No structured edit UI (table has no actions) [E6]; API PATCH `/api/income/[id]` [E7] | No UI delete (table has no actions) [E6]; API DELETE `/api/income/[id]` [E8] | Partial — UI requires date + amount input [E1][E2]; API incomeSchema enforces positive amount + paymentMode [E9] | E1 `src/components/IncomeFormDialog.tsx:36-40` “if (!date) { toast.error … }”<br>E2 `src/components/IncomeFormDialog.tsx:130-140` “<Input … type=\"number\" … required />”<br>E3 `src/app/api/income/route.ts:47-66` “const parsed = incomeSchema.safeParse …”<br>E4 `src/app/income/page.tsx:62-70` “prisma.income.findMany … count”<br>E5 `src/app/api/income/route.ts:14-45` “export async function GET …”<br>E6 `src/app/income/page.tsx:119-145` “<table …> … (no Actions column)”<br>E7 `src/app/api/income/[id]/route.ts:11-114` “export async function PATCH … requirePermission(…\"income.edit\") …”<br>E8 `src/app/api/income/[id]/route.ts:116-148` “export async function DELETE …”<br>E9 `src/lib/validation.ts:23-34` “amount: z.number().positive(); paymentMode: z.string().min(1)” |
| Projects | UI: ProjectFormDialog [E1]; API: POST `/api/projects` [E2] | UI list (Prisma findMany) [E3]; API GET `/api/projects` [E4] | Structured edit dialog (ProjectFormDialog) [E5]; API PATCH `/api/projects/[id]` [E6] | UI DeleteButton [E7]; API DELETE `/api/projects/[id]` [E8] | Mostly aligned — UI required fields [E9]; API projectSchema requires min(1) + nonnegative [E10] | E1 `src/components/ProjectFormDialog.tsx:70-94` “fetch(isEdit ? … : \"/api/projects\", …)”<br>E2 `src/app/api/projects/route.ts:29-47` “const parsed = projectSchema.safeParse …”<br>E3 `src/app/projects/page.tsx:52-59` “prisma.project.findMany …”<br>E4 `src/app/api/projects/route.ts:10-26` “export async function GET …”<br>E5 `src/components/ProjectsTable.tsx:65-73` “<Button … onClick={() => openEditDialog(project)}>Edit</Button>”<br>E6 `src/app/api/projects/[id]/route.ts:9-40` “export async function PATCH …”<br>E7 `src/components/ProjectsTable.tsx:72-73` “<DeleteButton url={`/api/projects/${project.id}`} />”<br>E8 `src/app/api/projects/[id]/route.ts:42-63` “export async function DELETE …”<br>E9 `src/components/ProjectFormDialog.tsx:141-209` “required” inputs (Project ID/Name/Start Date/Contract Value)<br>E10 `src/lib/validation.ts:46-54` “projectId … name … contractValue: z.number().nonnegative()” |
| Inventory | UI: InventoryFormDialog [E1]; API: POST `/api/inventory` [E2] | UI list (Prisma findMany) [E3]; API GET `/api/inventory` [E4] | QuickEdit prompt [E5][E6]; API PATCH `/api/inventory/[id]` [E7] | UI DeleteButton [E5]; API DELETE `/api/inventory/[id]` [E8] | Mostly aligned — UI required fields [E1]; API inventorySchema nonnegative [E9] | E1 `src/components/InventoryFormDialog.tsx:32-47` “fetch(\"/api/inventory\", …)” and `src/components/InventoryFormDialog.tsx:98-161` “required” inputs<br>E2 `src/app/api/inventory/route.ts:25-42` “const parsed = inventorySchema.safeParse …”<br>E3 `src/app/inventory/page.tsx:56-59` “prisma.inventoryItem.findMany …”<br>E4 `src/app/api/inventory/route.ts:10-22` “export async function GET …”<br>E5 `src/components/InventoryTable.tsx:98-108` “<QuickEditButton …/> … <DeleteButton …/>”<br>E6 `src/components/TableActions.tsx:27-50` “prompt(…) … PATCH”<br>E7 `src/app/api/inventory/[id]/route.ts:9-41` “export async function PATCH …”<br>E8 `src/app/api/inventory/[id]/route.ts:43-63` “export async function DELETE …”<br>E9 `src/lib/validation.ts:72-82` “unitCost: z.number().nonnegative() …” |
| Clients | UI: ClientFormDialog/ClientForm [E1]; API: POST `/api/clients` [E2] | UI list (Prisma findMany) [E3]; API GET `/api/clients` [E4] | QuickEdit prompt [E5]; API PATCH `/api/clients/[id]` [E6] | UI DeleteButton [E5]; API DELETE `/api/clients/[id]` [E7] | Mismatch — UI does not require Business Name [E8]; API clientSchema requires name min(1) [E9] | E1 `src/components/ClientFormDialog.tsx:12-27` and `src/components/ClientForm.tsx:47-65` “fetch(\"/api/clients\", …)”<br>E2 `src/app/api/clients/route.ts:27-46` “const parsed = clientSchema.safeParse …”<br>E3 `src/app/clients/page.tsx:48-57` “prisma.client.findMany …”<br>E4 `src/app/api/clients/route.ts:9-24` “export async function GET …”<br>E5 `src/app/clients/page.tsx:111-116` “<QuickEditButton …/> <DeleteButton …/>”<br>E6 `src/app/api/clients/[id]/route.ts:8-55` “export async function PATCH …”<br>E7 `src/app/api/clients/[id]/route.ts:58-89` “export async function DELETE …”<br>E8 `src/components/ClientForm.tsx:92-98` “<Input … Business Name …>” (no `required` attr)<br>E9 `src/lib/validation.ts:56-69` “name: z.string().min(1)” |
| Invoices | UI: InvoiceFormDialog [E1]; API: POST expects invoiceNo/projectId/date [E2][E3] | UI list (Prisma findMany) [E4]; API GET `/api/invoices` [E5] | QuickEdit prompt [E6][E7]; API PATCH `/api/invoices/[id]` [E8] | UI DeleteButton [E6]; API DELETE `/api/invoices/[id]` [E9] | Mismatch — UI sends invoiceNumber/clientName vs API invoiceSchema invoiceNo/projectId/date [E1][E2][E3] | E1 `src/components/InvoiceFormDialog.tsx:31-46` “invoiceNumber … clientName … issueDate …”<br>E2 `src/lib/validation.ts:107-115` “invoiceNo … projectId … date …”<br>E3 `src/app/api/invoices/route.ts:37-64` “invoiceNo … projectId … date …”<br>E4 `src/app/invoices/page.tsx:151-183` “<table …> … <QuickEditButton …/>”<br>E5 `src/app/api/invoices/route.ts:11-23` “export async function GET …”<br>E6 `src/app/invoices/page.tsx:177-183` “<QuickEditButton …/> <DeleteButton …/>”<br>E7 `src/components/TableActions.tsx:27-50` “prompt(…) … PATCH”<br>E8 `src/app/api/invoices/[id]/route.ts:10-46` “export async function PATCH …”<br>E9 `src/app/api/invoices/[id]/route.ts:48-76` “export async function DELETE …” |
| Quotations | No create UI/API (GET only) [E1][E2] | UI list + detail (Prisma findMany/findUnique) [E3][E4]; API GET `/api/quotations` + `/api/quotations/[id]` [E1][E2] | No update UI/API (GET only) [E1][E2] | No delete UI/API (GET only) [E1][E2] | N/A (read‑only) [E1][E2] | E1 `src/app/api/quotations/route.ts:6-25` “export async function GET …”<br>E2 `src/app/api/quotations/[id]/route.ts:6-27` “export async function GET …”<br>E3 `src/app/quotations/page.tsx:49-65` “prisma.quotation.findMany …”<br>E4 `src/app/quotations/[id]/page.tsx:28-33` “prisma.quotation.findUnique …” |
| Employees | UI: EmployeeFormDialog [E1]; API: POST `/api/employees` [E2] | UI list (Prisma findMany) [E3]; API GET `/api/employees` [E4] | QuickEdit prompt [E5][E6]; API PATCH `/api/employees/[id]` [E7] | UI DeleteButton [E5]; API DELETE `/api/employees/[id]` [E8] | Mostly aligned — UI requires name/email [E9]; API employeeSchema requires min(1) [E10] | E1 `src/components/EmployeeFormDialog.tsx:28-42` “fetch(\"/api/employees\", …)”<br>E2 `src/app/api/employees/route.ts:25-43` “const parsed = employeeSchema.safeParse …”<br>E3 `src/app/employees/page.tsx:74-82` “prisma.employee.findMany …”<br>E4 `src/app/api/employees/route.ts:10-22` “export async function GET …”<br>E5 `src/components/EmployeesTable.tsx:91-96` “<QuickEditButton …/> <DeleteButton …/>”<br>E6 `src/components/TableActions.tsx:27-50` “prompt(…) … PATCH”<br>E7 `src/app/api/employees/[id]/route.ts:8-38` “export async function PATCH …”<br>E8 `src/app/api/employees/[id]/route.ts:40-60` “export async function DELETE …”<br>E9 `src/components/EmployeeFormDialog.tsx:86-107` “required” inputs (name/email)<br>E10 `src/lib/validation.ts:93-98` “email: z.string().email(); name: z.string().min(1)” |

### 3) Security & RBAC parity (API vs UI)

#### 3.1 API permission parity matrix (all `src/app/api/**/route.ts`)

**Table A — Auth/User/Notifications/Attachments/Audit/Dashboard/Categories**
| Route | Auth check present? | Permission(s) enforced? | Scope logic (own/team/all) | Sensitive fields returned? | Risk rating | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | Delegated to NextAuth handlers (no explicit auth guard here) [E1] | N/A (handlers encapsulate auth) [E1] | N/A [E1] | N/A [E1] | Low (auth entrypoint only) [E1] | E1 `src/app/api/auth/[...nextauth]/route.ts:1-3` “export const { GET, POST } = handlers;” |
| `/api/register` | No (no `auth()` usage) [E1] | None [E1] | N/A (creates user) [E1] | Returns `{ id, email }` [E2] | Medium — public registration without auth gate [E1] | E1 `src/app/api/register/route.ts:12-55` “export async function POST … prisma.user.create …”<br>E2 `src/app/api/register/route.ts:54-55` “return NextResponse.json({ success: true, data: { id: user.id, email: user.email } })” |
| `/api/users/role` | Yes (`auth()` + 401) [E1] | `employees.view_all` [E2] | None (role assignment by email) [E3] | Returns updated user object [E4] | Medium — powerful admin action but permissioned [E2] | E1 `src/app/api/users/role/route.ts:8-11` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/users/role/route.ts:13-15` “requirePermission(…\"employees.view_all\")”<br>E3 `src/app/api/users/role/route.ts:18-41` “roleName … prisma.user.update …”<br>E4 `src/app/api/users/role/route.ts:39-45` “return NextResponse.json({ success: true, data: updated })” |
| `/api/categories` | Optional (auth checked but no 401 if missing) [E1] | If session: `categories.manage` OR `expenses.submit` OR `inventory.view` OR `income.add` [E2] | Global list of active categories [E3] | Returns full category objects (name, maxAmount, enforceStrict) [E4] | Low/Medium — unauth access to category metadata [E1][E4] | E1 `src/app/api/categories/route.ts:6-18` “const session = await auth(); … if (hasSession) { … }”<br>E2 `src/app/api/categories/route.ts:10-16` “requirePermission …”<br>E3 `src/app/api/categories/route.ts:23-31` “where: { isActive: true, type? }”<br>E4 `src/app/api/categories/route.ts:31-51` “select: { … maxAmount … enforceStrict … } … return … categories” |
| `/api/notifications` | Yes (`auth()` + 401) [E1] | GET uses `notifications.view_all` for scope only [E2]; POST requires `notifications.edit` [E3] | GET scopes to `userId` unless view_all [E2] | Returns full notification objects [E4] | Low — scoped read, permissioned write [E2][E3] | E1 `src/app/api/notifications/route.ts:9-13` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/notifications/route.ts:15-18` “canViewAll … where: canViewAll ? {} : { userId … }”<br>E3 `src/app/api/notifications/route.ts:31-33` “requirePermission(…\"notifications.edit\")”<br>E4 `src/app/api/notifications/route.ts:16-22` “prisma.notification.findMany … return … data” |
| `/api/notifications/[id]` | Yes (`auth()` + 401) [E1] | `notifications.edit` [E2] | None (updates by id; no ownership check) [E3] | Returns updated notification [E4] | Medium — can edit any notification id with permission [E2][E3] | E1 `src/app/api/notifications/[id]/route.ts:8-11` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/notifications/[id]/route.ts:13-15` “requirePermission(…\"notifications.edit\")”<br>E3 `src/app/api/notifications/[id]/route.ts:26-27` “prisma.notification.update({ where: { id } … })”<br>E4 `src/app/api/notifications/[id]/route.ts:36-37` “return NextResponse.json({ success: true, data: updated })” |
| `/api/attachments` | Yes (`auth()` + 401) [E1] | GET: `attachments.view_all` [E2]; POST: `attachments.edit` [E3] | None (returns all attachments) [E4] | Returns attachment records incl. fileUrl/fileId [E5] | High — no parent-record authorization [E4][E5] | E1 `src/app/api/attachments/route.ts:8-12` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/attachments/route.ts:14-16` “requirePermission(…\"attachments.view_all\")”<br>E3 `src/app/api/attachments/route.ts:33-35` “requirePermission(…\"attachments.edit\")”<br>E4 `src/app/api/attachments/route.ts:19-23` “prisma.attachment.findMany …”<br>E5 `src/app/api/attachments/route.ts:47-56` “attachment.create({ data: { … fileUrl … fileId … } })” |
| `/api/attachments/[id]` | Yes (`auth()` + 401) [E1] | `attachments.edit` [E2] | None (update/delete by id) [E3] | Returns updated attachment [E4] | High — no parent-record authorization [E3] | E1 `src/app/api/attachments/[id]/route.ts:8-11` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/attachments/[id]/route.ts:13-15` “requirePermission(…\"attachments.edit\")”<br>E3 `src/app/api/attachments/[id]/route.ts:26-27` “prisma.attachment.update({ where: { id } … })” and `src/app/api/attachments/[id]/route.ts:50-52` “prisma.attachment.delete …”<br>E4 `src/app/api/attachments/[id]/route.ts:36-37` “return … data: updated” |
| `/api/audit` | Yes (`auth()` + 401) [E1] | None (no permission check) [E2] | None (returns all audit logs) [E3] | Returns audit logs [E3] | High — org-wide logs behind auth only [E2][E3] | E1 `src/app/api/audit/route.ts:5-9` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/audit/route.ts:5-16` “no requirePermission present”<br>E3 `src/app/api/audit/route.ts:11-14` “prisma.auditLog.findMany …” |
| `/api/dashboard` | Yes (`auth()` + 401) [E1] | None (no permission check) [E2] | None (org-wide aggregates) [E3] | Returns org totals (income/expense/stock) [E4] | Medium — org-wide totals without permission gate [E2][E3] | E1 `src/app/api/dashboard/route.ts:5-9` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/dashboard/route.ts:5-40` “no requirePermission present”<br>E3 `src/app/api/dashboard/route.ts:11-22` “prisma.expense.aggregate … prisma.project.aggregate …”<br>E4 `src/app/api/dashboard/route.ts:30-39` “return … totalExpenses … totalIncome …” |

**Table B — Expenses/Income/Approvals**
| Route | Auth check present? | Permission(s) enforced? | Scope logic (own/team/all) | Sensitive fields returned? | Risk rating | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/expenses` | Yes (`auth()` + 401) [E1] | GET: `expenses.view_all` or `expenses.view_own` [E2]; POST: `expenses.submit` [E3] | GET scopes to `submittedById` when not view_all [E4] | Returns full expense + submittedBy/approvedBy emails [E5] | Medium — sensitive data but permissioned [E2][E5] | E1 `src/app/api/expenses/route.ts:42-46` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/expenses/route.ts:48-53` “requirePermission(…\"expenses.view_all\") … view_own”<br>E3 `src/app/api/expenses/route.ts:166-168` “requirePermission(…\"expenses.submit\")”<br>E4 `src/app/api/expenses/route.ts:80-83` “if (!canViewAll) { where.submittedById = … }”<br>E5 `src/app/api/expenses/route.ts:118-137` “include: { submittedBy … approvedBy … } … return … expenses” |
| `/api/expenses/[id]` | Yes (`auth()` + 401) [E1] | `expenses.edit` OR owner + pending [E2] | By id; owner pending allowed [E2] | Returns updated expense [E3] | Medium — edit scoped by permission/ownership [E2] | E1 `src/app/api/expenses/[id]/route.ts:13-16` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/expenses/[id]/route.ts:24-27` “requirePermission(…\"expenses.edit\") … isOwner …”<br>E3 `src/app/api/expenses/[id]/route.ts:165-166` “return NextResponse.json({ success: true, data: updated })” |
| `/api/expenses/[id]/mark-as-paid` | Yes (`auth()` + 401) [E1] | `expenses.mark_paid` [E2] | By id; only if status APPROVED [E3] | Returns updated expense [E4] | Medium — payment action gated by permission [E2] | E1 `src/app/api/expenses/[id]/mark-as-paid/route.ts:12-15` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/expenses/[id]/mark-as-paid/route.ts:17-19` “requirePermission(…\"expenses.mark_paid\")”<br>E3 `src/app/api/expenses/[id]/mark-as-paid/route.ts:30-34` “if (expense.status !== 'APPROVED') … 400”<br>E4 `src/app/api/expenses/[id]/mark-as-paid/route.ts:52-53` “return … data: updatedExpense” |
| `/api/expenses/export` | Yes (`auth()` + 401) [E1] | `expenses.view_all` OR `expenses.view_own` [E2] | Scopes to `submittedById` when not view_all [E3] | CSV includes emails + receipt URL [E4] | Medium — exports sensitive data [E4] | E1 `src/app/api/expenses/export/route.ts:18-24` “if (!userId) … 401”<br>E2 `src/app/api/expenses/export/route.ts:26-31` “requirePermission(…\"expenses.view_all\") … view_own”<br>E3 `src/app/api/expenses/export/route.ts:33-35` “where: canViewAll ? {} : { submittedById: userId }”<br>E4 `src/app/api/expenses/export/route.ts:53-71` “Submitted By … Approved By … Receipt URL …” |
| `/api/income` | Yes (`auth()` + 401) [E1] | GET: `income.view_all` OR `income.view_own` [E2]; POST: `income.add` [E3] | GET scopes to `addedById` when not view_all [E4] | Returns full income objects [E5] | Medium — sensitive amounts but permissioned [E2][E5] | E1 `src/app/api/income/route.ts:15-18` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/income/route.ts:20-23` “requirePermission(…\"income.view_all\") … view_own”<br>E3 `src/app/api/income/route.ts:54-56` “requirePermission(…\"income.add\")”<br>E4 `src/app/api/income/route.ts:30-31` “where: canViewAll ? {} : { addedById: session.user.id }”<br>E5 `src/app/api/income/route.ts:38-44` “prisma.income.findMany … return … data” |
| `/api/income/[id]` | Yes (`auth()` + 401) [E1] | `income.edit` OR owner + pending [E2] | By id; owner pending allowed [E2] | Returns updated income [E3] | Medium — edit gated by permission/ownership [E2] | E1 `src/app/api/income/[id]/route.ts:12-15` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/income/[id]/route.ts:23-27` “requirePermission(…\"income.edit\") … isOwner …”<br>E3 `src/app/api/income/[id]/route.ts:113-114` “return NextResponse.json({ success: true, data: result })” |
| `/api/income/export` | Yes (`auth()` + 401) [E1] | `income.view_all` OR `income.view_own` [E2] | Scopes to `addedById` when not view_all [E3] | CSV includes emails + receipt URL [E4] | Medium — exports sensitive data [E4] | E1 `src/app/api/income/export/route.ts:18-24` “if (!userId) … 401”<br>E2 `src/app/api/income/export/route.ts:26-31` “requirePermission(…\"income.view_all\") … view_own”<br>E3 `src/app/api/income/export/route.ts:33-35` “where: canViewAll ? {} : { addedById: userId }”<br>E4 `src/app/api/income/export/route.ts:52-71` “Added By … Approved By … Receipt URL …” |
| `/api/approvals` | Yes (`auth()` + 401) [E1] | GET: none (no permission check) [E2]; POST/PUT: `canApproveWithRole` [E3] | GET uses `getPendingApprovalsForUser` (per-user) but no permission gate [E4] | Returns pending approvals data [E4] | High — approvals GET behind auth only [E2][E4] | E1 `src/app/api/approvals/route.ts:31-34` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/approvals/route.ts:30-52` “GET … no requirePermission / canApproveWithRole”<br>E3 `src/app/api/approvals/route.ts:71-76` and `src/app/api/approvals/route.ts:198-202` “if (!canApproveWithRole(roleName)) … 403”<br>E4 `src/app/api/approvals/route.ts:46-52` “const pendingApprovals = await getPendingApprovalsForUser … return … data” |

**Table C — Projects/Inventory/Wallets**
| Route | Auth check present? | Permission(s) enforced? | Scope logic (own/team/all) | Sensitive fields returned? | Risk rating | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/projects` | Yes (`auth()` + 401) [E1] | GET: `projects.view_all` or `projects.view_assigned` [E2]; POST: `projects.edit` [E3] | GET returns all projects (no scope) [E4] | Returns project + client data [E4] | Medium — view_assigned still gets all [E2][E4] | E1 `src/app/api/projects/route.ts:10-13` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/projects/route.ts:16-19` “requirePermission(…\"projects.view_all\") … view_assigned”<br>E3 `src/app/api/projects/route.ts:35-38` “requirePermission(…\"projects.edit\")”<br>E4 `src/app/api/projects/route.ts:22-25` “prisma.project.findMany … include: { client: true }” |
| `/api/projects/[id]` | Yes (`auth()` + 401) [E1] | `projects.edit` [E2] | By id [E3] | Returns updated project [E4] | Low/Medium — edit gated by permission [E2] | E1 `src/app/api/projects/[id]/route.ts:9-13` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/projects/[id]/route.ts:14-17` “requirePermission(…\"projects.edit\")”<br>E3 `src/app/api/projects/[id]/route.ts:19-29` “const { id } … prisma.project.update …”<br>E4 `src/app/api/projects/[id]/route.ts:39-40` “return … data: updated” |
| `/api/projects/financial` | Yes (`auth()` + 401) [E1] | `projects.view_all` or `projects.view_assigned` [E2] | Returns all projects (no scope filter) [E3] | Returns financial metrics (contractValue, costToDate, margin) [E4] | High — financials exposed without assignment scope [E2][E3] | E1 `src/app/api/projects/financial/route.ts:6-10` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/projects/financial/route.ts:12-16` “requirePermission(…\"projects.view_all\") … view_assigned”<br>E3 `src/app/api/projects/financial/route.ts:21-27` “prisma.project.findMany … include: { client: true }”<br>E4 `src/app/api/projects/financial/route.ts:52-67` “contractValue … costToDate … grossMargin …” |
| `/api/inventory` | Yes (`auth()` + 401) [E1] | GET: `inventory.view` [E2]; POST: `inventory.adjust` [E3] | Returns all items (no scope) [E4] | Returns unitCost/sellingPrice fields [E4] | Medium — inventory data visible to any `inventory.view` role [E2][E4] | E1 `src/app/api/inventory/route.ts:10-14` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/inventory/route.ts:16-18` “requirePermission(…\"inventory.view\")”<br>E3 `src/app/api/inventory/route.ts:31-33` “requirePermission(…\"inventory.adjust\")”<br>E4 `src/app/api/inventory/route.ts:21-22` “prisma.inventoryItem.findMany … return … data” |
| `/api/inventory/[id]` | Yes (`auth()` + 401) [E1] | `inventory.adjust` [E2] | By id [E3] | Returns updated inventory item [E4] | Medium — adjust gated by permission [E2] | E1 `src/app/api/inventory/[id]/route.ts:9-13` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/inventory/[id]/route.ts:14-17` “requirePermission(…\"inventory.adjust\")”<br>E3 `src/app/api/inventory/[id]/route.ts:19-31` “prisma.inventoryItem.update …”<br>E4 `src/app/api/inventory/[id]/route.ts:41-42` “return … data: updated” |
| `/api/inventory/ledger` | Yes (`auth()` + 401) [E1] | `inventory.adjust` [E2] | By itemId; no user scope [E3] | Returns ledger entry with costs [E4] | Medium — write access gated, but no per‑user scope [E2] | E1 `src/app/api/inventory/ledger/route.ts:10-14` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/inventory/ledger/route.ts:16-18` “requirePermission(…\"inventory.adjust\")”<br>E3 `src/app/api/inventory/ledger/route.ts:40-52` “itemId … newQty …”<br>E4 `src/app/api/inventory/ledger/route.ts:57-85` “inventoryLedger.create … unitCost … total …” |
| `/api/inventory/ledger/export` | Yes (`auth()` + 401) [E1] | `inventory.view` (+ `inventory.view_cost` toggles columns) [E2] | No per-user scope; filters by query/type/date [E3] | CSV includes unitCost/total when allowed [E4] | Medium — exports sensitive cost data [E2][E4] | E1 `src/app/api/inventory/ledger/export/route.ts:18-22` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/inventory/ledger/export/route.ts:24-28` “requirePermission(…\"inventory.view\") … view_cost”<br>E3 `src/app/api/inventory/ledger/export/route.ts:45-59` “where … query/type/date”<br>E4 `src/app/api/inventory/ledger/export/route.ts:67-92` “header … Unit Cost … Total …” |
| `/api/wallets/export` | Yes (`auth()` + 401) [E1] | `employees.view_all` OR `employees.edit_wallet` OR `employees.view_own` [E2] | Scopes to employeeId when not view_all/edit [E3] | CSV includes employee name/email + balances [E4] | Medium — exports employee wallet data [E4] | E1 `src/app/api/wallets/export/route.ts:18-22` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/wallets/export/route.ts:24-30` “requirePermission(…\"employees.view_all\") … edit_wallet … view_own”<br>E3 `src/app/api/wallets/export/route.ts:38-42` “baseWhere = { employeeId: employee.id }”<br>E4 `src/app/api/wallets/export/route.ts:71-80` “Employee … Email … Amount … Balance …” |

**Table D — Invoices/Quotations/Payment Modes/Income Sources**
| Route | Auth check present? | Permission(s) enforced? | Scope logic (own/team/all) | Sensitive fields returned? | Risk rating | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/invoices` | Yes (`auth()` + 401) [E1] | GET: `invoices.view_all` [E2]; POST: `invoices.create` [E3] | Returns all invoices (no scope) [E4] | Returns invoice amounts + project IDs [E4] | Medium — no scope filter [E4] | E1 `src/app/api/invoices/route.ts:11-15` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/invoices/route.ts:17-19` “requirePermission(…\"invoices.view_all\")”<br>E3 `src/app/api/invoices/route.ts:32-34` “requirePermission(…\"invoices.create\")”<br>E4 `src/app/api/invoices/route.ts:22-23` “prisma.invoice.findMany … return … data” |
| `/api/invoices/[id]` | Yes (`auth()` + 401) [E1] | `invoices.edit` [E2] | By id [E3] | Returns updated invoice [E4] | Medium — edit gated by permission [E2] | E1 `src/app/api/invoices/[id]/route.ts:10-13` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/invoices/[id]/route.ts:15-17` “requirePermission(…\"invoices.edit\")”<br>E3 `src/app/api/invoices/[id]/route.ts:20-34` “const { id } … prisma.invoice.update …”<br>E4 `src/app/api/invoices/[id]/route.ts:46-47` “return … data: updated” |
| `/api/quotations` | Yes (`auth()` + 401) [E1] | `quotations.view_all` [E2] | Returns all quotations (no scope) [E3] | Returns quotation + client data [E3] | Medium — no scope filter [E3] | E1 `src/app/api/quotations/route.ts:6-10` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/quotations/route.ts:12-14` “requirePermission(…\"quotations.view_all\")”<br>E3 `src/app/api/quotations/route.ts:17-23` “prisma.quotation.findMany … include: { client … }” |
| `/api/quotations/[id]` | Yes (`auth()` + 401) [E1] | `quotations.view_all` [E2] | By id [E3] | Returns quotation + lineItems [E3] | Medium — detailed quote data [E3] | E1 `src/app/api/quotations/[id]/route.ts:6-10` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/quotations/[id]/route.ts:12-14` “requirePermission(…\"quotations.view_all\")”<br>E3 `src/app/api/quotations/[id]/route.ts:18-21` “include: { client: true, lineItems: true }” |
| `/api/payment-modes` | Yes (`auth()` + 401) [E1] | None (auth-only) [E2] | Global distinct list [E3] | Returns payment mode strings [E3] | Low — metadata only [E3] | E1 `src/app/api/payment-modes/route.ts:5-9` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/payment-modes/route.ts:1-21` “no requirePermission present”<br>E3 `src/app/api/payment-modes/route.ts:11-21` “findMany … distinct … return … data” |
| `/api/income-sources` | Yes (`auth()` + 401) [E1] | None (auth-only) [E2] | Global distinct list [E3] | Returns income source strings [E3] | Low — metadata only [E3] | E1 `src/app/api/income-sources/route.ts:5-9` “if (!session?.user?.id) … 401”<br>E2 `src/app/api/income-sources/route.ts:1-21` “no requirePermission present”<br>E3 `src/app/api/income-sources/route.ts:11-21` “findMany … distinct … return … data” |

#### 3.2 Unauthenticated endpoints (intended vs risk)
- `/api/categories` GET allows access without session (auth optional). Evidence: `src/app/api/categories/route.ts:6-18` “const session = await auth(); … if (hasSession) { … }”
- `/api/register` POST has no auth gate. Evidence: `src/app/api/register/route.ts:12-55` (no `auth()` call)
- `/api/auth/[...nextauth]` GET/POST are public auth handlers. Evidence: `src/app/api/auth/[...nextauth]/route.ts:1-3`

#### 3.3 Attachments authorization (parent record access)
- Attachment routes do not validate that the caller has permission to the parent record (`recordId` is accepted directly). Evidence: `src/app/api/attachments/route.ts:47-56` “attachment.create({ data: { type, recordId, fileUrl … } })” and no parent lookup/permission in `src/app/api/attachments/route.ts:27-56`; updates/deletes use id only `src/app/api/attachments/[id]/route.ts:18-27` and `src/app/api/attachments/[id]/route.ts:50-52`.

### 4) Role-by-role workflow matrix (release readiness)

#### Role: Owner/CEO
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (roles exist with wildcard `*`) `src/lib/permissions.ts:2-3`; NextAuth handlers `src/app/api/auth/[...nextauth]/route.ts:1-3` |
| Can view dashboard (scope) | ✅ (auth-only; org-wide) `src/app/dashboard/page.tsx:19-21` and `src/app/api/dashboard/route.ts:5-9` |
| Expenses: create/submit/edit/approve/mark paid/export | submit ✅ (wildcard `src/lib/permissions.ts:2-3` + API gate `src/app/api/expenses/route.ts:166-168`)<br>edit ✅ (wildcard + `src/app/api/expenses/[id]/route.ts:24-27`)<br>approve ✅ (wildcard + `src/app/api/approvals/route.ts:16-24`)<br>mark paid ✅ (wildcard + `src/app/api/expenses/[id]/mark-as-paid/route.ts:17-19`)<br>export ✅ (wildcard + `src/app/api/expenses/export/route.ts:26-31`) |
| Income: create/edit/approve/export | create ✅ (wildcard + `src/app/api/income/route.ts:54-56`)<br>edit ✅ (wildcard + `src/app/api/income/[id]/route.ts:23-27`)<br>approve ✅ (wildcard + `src/app/api/approvals/route.ts:16-24` used for approval) <br>export ✅ (wildcard + `src/app/api/income/export/route.ts:26-31`) |
| Projects: create/edit/assigned view/financials | create/edit ✅ (wildcard + `src/app/api/projects/route.ts:35-38` and `src/app/api/projects/[id]/route.ts:14-17`)<br>assigned view ✅ (wildcard + `src/app/api/projects/route.ts:16-19`)<br>financials ✅ (wildcard + `src/app/api/projects/financial/route.ts:12-16`) |
| Inventory: view/adjust/ledger export | view ✅ (wildcard + `src/app/api/inventory/route.ts:16-18`)<br>adjust ✅ (wildcard + `src/app/api/inventory/route.ts:31-33` and `src/app/api/inventory/[id]/route.ts:14-17`)<br>ledger export ✅ (wildcard + `src/app/api/inventory/ledger/export/route.ts:24-28`) |
| Employees: view own/team/all; wallet view/edit | view all ✅ (wildcard + UI checks `src/app/employees/page.tsx:22-24`; API `src/app/api/employees/route.ts:16-19`)<br>wallet view ✅ (wildcard + `src/app/wallets/page.tsx:22-24`)<br>wallet edit ✅ (wildcard + `src/app/api/employees/wallet/route.ts:15-17`) |
| Reports: own/team/all | view all ✅ (wildcard + `src/app/reports/page.tsx:16-20`) |
| Audit log access | ✅ (wildcard + `src/app/audit/page.tsx:20-22`) |

#### Role: CFO / Finance Manager
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (roles defined) CFO `src/lib/permissions.ts:38-75`; Finance Manager `src/lib/permissions.ts:151-189`; NextAuth handlers `src/app/api/auth/[...nextauth]/route.ts:1-3` |
| Can view dashboard (scope) | ✅ (perm `dashboard.view` in CFO/FM lists `src/lib/permissions.ts:38-41` and `src/lib/permissions.ts:151-154`; dashboard auth gate `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | submit ❌ (not in CFO/FM lists `src/lib/permissions.ts:38-75` / `src/lib/permissions.ts:151-189`; API requires `expenses.submit` `src/app/api/expenses/route.ts:166-168`)<br>edit ✅ (perm `expenses.edit` `src/lib/permissions.ts:49` / `src/lib/permissions.ts:162`; API `src/app/api/expenses/[id]/route.ts:24-27`)<br>approve ✅ (perm `expenses.approve_*` `src/lib/permissions.ts:45-48` / `src/lib/permissions.ts:158-161`; API `src/app/api/approvals/route.ts:16-24`)<br>mark paid ❌ (perm `expenses.mark_paid` not in lists; API `src/app/api/expenses/[id]/mark-as-paid/route.ts:17-19`)<br>export ✅ (perm `expenses.view_all` `src/lib/permissions.ts:44-45` / `src/lib/permissions.ts:157-158`; API `src/app/api/expenses/export/route.ts:26-31`) |
| Income: create/edit/approve/export | create ✅ (perm `income.add` `src/lib/permissions.ts:51-52` / `src/lib/permissions.ts:164-165`; API `src/app/api/income/route.ts:54-56`)<br>edit ✅ (perm `income.edit` `src/lib/permissions.ts:52` / `src/lib/permissions.ts:165-166`; API `src/app/api/income/[id]/route.ts:23-27`)<br>approve ✅ (approvals perms `src/lib/permissions.ts:55-57` / `src/lib/permissions.ts:168-170`; API `src/app/api/approvals/route.ts:16-24`)<br>export ✅ (perm `income.view_all` `src/lib/permissions.ts:50` / `src/lib/permissions.ts:163`; API `src/app/api/income/export/route.ts:26-31`) |
| Projects: create/edit/assigned view/financials | create/edit ✅ (perm `projects.edit` `src/lib/permissions.ts:64-65` / `src/lib/permissions.ts:176-177`; API `src/app/api/projects/route.ts:35-38` + `src/app/api/projects/[id]/route.ts:14-17`)<br>assigned view ✅ (perm `projects.view_all` `src/lib/permissions.ts:63` / `src/lib/permissions.ts:176`; API `src/app/api/projects/route.ts:16-19`)<br>financials ✅ (perm `projects.view_financials` `src/lib/permissions.ts:65-66` / `src/lib/permissions.ts:178`; API `src/app/api/projects/financial/route.ts:12-16`) |
| Inventory: view/adjust/ledger export | view ✅ (perm `inventory.view` `src/lib/permissions.ts:58` / `src/lib/permissions.ts:171`; API `src/app/api/inventory/route.ts:16-18`)<br>adjust ✅ (perm `inventory.adjust` `src/lib/permissions.ts:61` / `src/lib/permissions.ts:174`; API `src/app/api/inventory/route.ts:31-33`)<br>ledger export ✅ (perm `inventory.view` `src/lib/permissions.ts:58` / `src/lib/permissions.ts:171`; API `src/app/api/inventory/ledger/export/route.ts:24-28`) |
| Employees: view own/team/all; wallet view/edit | view all ✅ (perm `employees.view_all` `src/lib/permissions.ts:71` / `src/lib/permissions.ts:184`; API `src/app/api/employees/route.ts:16-19`)<br>wallet view ✅ (perm `employees.view_all` `src/lib/permissions.ts:71` / `src/lib/permissions.ts:184`; UI `src/app/wallets/page.tsx:22-24`)<br>wallet edit ✅ (perm `employees.edit_wallet` `src/lib/permissions.ts:72` / `src/lib/permissions.ts:185`; API `src/app/api/employees/wallet/route.ts:15-17`) |
| Reports: own/team/all | view all ✅ (perm `reports.view_all` `src/lib/permissions.ts:69` / `src/lib/permissions.ts:182`; UI `src/app/reports/page.tsx:16-20`) |
| Audit log access | ✅ (`reports.view_all` in CFO/FM lists `src/lib/permissions.ts:69` / `src/lib/permissions.ts:182`; audit page gate `src/app/audit/page.tsx:20-22`) |

#### Role: Manager / Project Manager
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (Manager role exists; “Project Manager” not defined) `src/lib/permissions.ts:191-212` and `src/lib/permissions.ts:227-228` |
| Can view dashboard (scope) | ✅ (perm `dashboard.view` in Manager list `src/lib/permissions.ts:192`; dashboard auth gate `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | submit ✅ (perm `expenses.submit` `src/lib/permissions.ts:196`; API `src/app/api/expenses/route.ts:166-168`)<br>edit ❌ (no `expenses.edit` in Manager list `src/lib/permissions.ts:191-212`; API requires `expenses.edit` `src/app/api/expenses/[id]/route.ts:24-27`)<br>approve ✅ low‑level only (perm `expenses.approve_low` `src/lib/permissions.ts:197` + `approvals.approve_low` `src/lib/permissions.ts:202`; API `src/app/api/approvals/route.ts:16-24`)<br>mark paid ❌ (perm `expenses.mark_paid` not in list; API `src/app/api/expenses/[id]/mark-as-paid/route.ts:17-19`)<br>export ✅ (perm `expenses.view_all` `src/lib/permissions.ts:195`; API `src/app/api/expenses/export/route.ts:26-31`) |
| Income: create/edit/approve/export | create ✅ (perm `income.add` `src/lib/permissions.ts:200`; API `src/app/api/income/route.ts:54-56`)<br>edit ❌ (no `income.edit` in list; API `src/app/api/income/[id]/route.ts:23-27`)<br>approve ✅ low‑level only (perm `approvals.approve_low` `src/lib/permissions.ts:202`; API `src/app/api/approvals/route.ts:16-24`)<br>export ✅ (perm `income.view_all` `src/lib/permissions.ts:199`; API `src/app/api/income/export/route.ts:26-31`) |
| Projects: create/edit/assigned view/financials | create/edit ❌ (no `projects.edit` in list `src/lib/permissions.ts:191-212`; API `src/app/api/projects/route.ts:35-38` + `src/app/api/projects/[id]/route.ts:14-17`)<br>assigned view ✅ (perm `projects.view_assigned` `src/lib/permissions.ts:207`; API `src/app/api/projects/route.ts:16-19`)<br>financials ✅ (perm `projects.view_all`/`view_assigned` in list `src/lib/permissions.ts:206-207`; API `src/app/api/projects/financial/route.ts:12-16`) |
| Inventory: view/adjust/ledger export | view ✅ (perm `inventory.view` `src/lib/permissions.ts:203`; API `src/app/api/inventory/route.ts:16-18`)<br>adjust ❌ (no `inventory.adjust` in list; API `src/app/api/inventory/route.ts:31-33`)<br>ledger export ✅ (perm `inventory.view` `src/lib/permissions.ts:203`; API `src/app/api/inventory/ledger/export/route.ts:24-28`) |
| Employees: view own/team/all; wallet view/edit | view team ✅ (perm `employees.view_team` `src/lib/permissions.ts:210`; UI `src/app/employees/page.tsx:22-24`)<br>view all ❌ (no `employees.view_all` in list; API `src/app/api/employees/route.ts:16-19`)<br>wallet view/edit ❌ (no `employees.edit_wallet` or `employees.view_own` in list; wallet UI/API `src/app/wallets/page.tsx:22-24`, `src/app/api/employees/wallet/route.ts:15-17`) |
| Reports: own/team/all | view team ✅ (perm `reports.view_team` `src/lib/permissions.ts:209`; UI `src/app/reports/page.tsx:16-20`) |
| Audit log access | ❌ (requires `reports.view_all`; Manager only has `reports.view_team` `src/lib/permissions.ts:209`; audit gate `src/app/audit/page.tsx:20-22`) |

#### Role: Procurement
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (role defined) `src/lib/permissions.ts:139-149` |
| Can view dashboard (scope) | ✅ (perm `dashboard.view` `src/lib/permissions.ts:140`; dashboard auth `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | submit ✅ (perm `expenses.submit` `src/lib/permissions.ts:142`; API `src/app/api/expenses/route.ts:166-168`)<br>edit ❌ (no `expenses.edit` in list; API `src/app/api/expenses/[id]/route.ts:24-27`)<br>approve ❌ (no approvals perms; API `src/app/api/approvals/route.ts:16-24`)<br>mark paid ❌ (no `expenses.mark_paid`; API `src/app/api/expenses/[id]/mark-as-paid/route.ts:17-19`)<br>export ✅ (perm `expenses.view_own` `src/lib/permissions.ts:141`; API `src/app/api/expenses/export/route.ts:26-31`) |
| Income: create/edit/approve/export | create ❌ (no `income.add` in list; API `src/app/api/income/route.ts:54-56`)<br>edit ❌ (no `income.edit`; API `src/app/api/income/[id]/route.ts:23-27`)<br>approve ❌ (no approvals perms; API `src/app/api/approvals/route.ts:16-24`)<br>export ❌ (no `income.view_own` in list; API `src/app/api/income/export/route.ts:26-31`) |
| Projects: create/edit/assigned view/financials | create/edit ❌ (no `projects.edit` in list; API `src/app/api/projects/route.ts:35-38`)<br>assigned view ✅ (perm `projects.view_assigned` `src/lib/permissions.ts:147`; API `src/app/api/projects/route.ts:16-19`)<br>financials ✅ (perm `projects.view_assigned` `src/lib/permissions.ts:147`; API `src/app/api/projects/financial/route.ts:12-16`) |
| Inventory: view/adjust/ledger export | view ✅ (perm `inventory.view` `src/lib/permissions.ts:143`; API `src/app/api/inventory/route.ts:16-18`)<br>adjust ✅ (perm `inventory.adjust` `src/lib/permissions.ts:146`; API `src/app/api/inventory/route.ts:31-33`)<br>ledger export ✅ (perm `inventory.view` `src/lib/permissions.ts:143`; API `src/app/api/inventory/ledger/export/route.ts:24-28`) |
| Employees: view own/team/all; wallet view/edit | view ❌ (no `employees.view_*` in list `src/lib/permissions.ts:139-149`; UI `src/app/employees/page.tsx:22-24`)<br>wallet view/edit ❌ (no `employees.edit_wallet` or `employees.view_own`; wallet UI/API `src/app/wallets/page.tsx:22-24`, `src/app/api/employees/wallet/route.ts:15-17`) |
| Reports: own/team/all | view own ✅ (perm `reports.view_own` `src/lib/permissions.ts:148`; UI `src/app/reports/page.tsx:16-20`) |
| Audit log access | ❌ (requires `reports.view_all`; Procurement only has `reports.view_own` `src/lib/permissions.ts:148`; audit gate `src/app/audit/page.tsx:20-22`) |

#### Role: Store / Warehouse
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ❌ (role not defined in PERMISSIONS/ROLE_OPTIONS) `src/lib/permissions.ts:1-225` and `src/lib/permissions.ts:227-228` |
| Can view dashboard (scope) | ❌ (no Store/Warehouse role mapping to `dashboard.view`) `src/lib/permissions.ts:1-225` |
| Expenses: create/submit/edit/approve/mark paid/export | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |
| Income: create/edit/approve/export | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |
| Projects: create/edit/assigned view/financials | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |
| Inventory: view/adjust/ledger export | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |
| Employees: view own/team/all; wallet view/edit | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |
| Reports: own/team/all | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |
| Audit log access | ❌ (role not defined; no permissions) `src/lib/permissions.ts:1-225` |

#### Role: Sales
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (role defined) `src/lib/permissions.ts:112-121` |
| Can view dashboard (scope) | ✅ (perm `dashboard.view` `src/lib/permissions.ts:113`; dashboard auth `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | ❌ (no expenses permissions in Sales list `src/lib/permissions.ts:112-121`; API gates `src/app/api/expenses/route.ts:166-168` / `src/app/api/expenses/[id]/route.ts:24-27`) |
| Income: create/edit/approve/export | ❌ (no income permissions in Sales list `src/lib/permissions.ts:112-121`; API gates `src/app/api/income/route.ts:54-56` / `src/app/api/income/[id]/route.ts:23-27`) |
| Projects: create/edit/assigned view/financials | create/edit ❌ (no `projects.edit` in list; API `src/app/api/projects/route.ts:35-38`)<br>assigned view ✅ (perm `projects.view_assigned` `src/lib/permissions.ts:117`; API `src/app/api/projects/route.ts:16-19`)<br>financials ✅ (perm `projects.view_all`/`view_assigned` `src/lib/permissions.ts:116-117`; API `src/app/api/projects/financial/route.ts:12-16`) |
| Inventory: view/adjust/ledger export | view ❌ (Sales has `inventory.view_selling` only `src/lib/permissions.ts:121`; API requires `inventory.view` `src/app/api/inventory/route.ts:16-18`)<br>adjust ❌ (no `inventory.adjust`; API `src/app/api/inventory/route.ts:31-33`)<br>ledger export ❌ (requires `inventory.view`; API `src/app/api/inventory/ledger/export/route.ts:24-28`) |
| Employees: view own/team/all; wallet view/edit | ❌ (no `employees.view_*` in list; UI `src/app/employees/page.tsx:22-24`) |
| Reports: own/team/all | view team ✅ (perm `reports.view_team` `src/lib/permissions.ts:119`; UI `src/app/reports/page.tsx:16-20`) |
| Audit log access | ❌ (requires `reports.view_all`; Sales only has `reports.view_team` `src/lib/permissions.ts:119`; audit gate `src/app/audit/page.tsx:20-22`) |

#### Role: HR
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (role defined) `src/lib/permissions.ts:132-138` |
| Can view dashboard (scope) | ✅ (perm `dashboard.view` `src/lib/permissions.ts:133`; dashboard auth `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | ❌ (no expenses permissions in HR list `src/lib/permissions.ts:132-138`; API gates `src/app/api/expenses/route.ts:166-168`) |
| Income: create/edit/approve/export | ❌ (no income permissions in HR list `src/lib/permissions.ts:132-138`; API `src/app/api/income/route.ts:54-56`) |
| Projects: create/edit/assigned view/financials | ❌ (no projects permissions in HR list `src/lib/permissions.ts:132-138`; API `src/app/api/projects/route.ts:16-19`) |
| Inventory: view/adjust/ledger export | ❌ (no inventory permissions in HR list `src/lib/permissions.ts:132-138`; API `src/app/api/inventory/route.ts:16-18`) |
| Employees: view own/team/all; wallet view/edit | view all ✅ (perm `employees.view_all` `src/lib/permissions.ts:134`; API `src/app/api/employees/route.ts:16-19`)<br>view team ✅ (perm `employees.view_team` `src/lib/permissions.ts:135`; UI `src/app/employees/page.tsx:22-24`)<br>wallet view ✅ (perm `employees.view_all` `src/lib/permissions.ts:134`; wallet UI `src/app/wallets/page.tsx:22-24`)<br>wallet edit ❌ (no `employees.edit_wallet` in HR list; API `src/app/api/employees/wallet/route.ts:15-17`) |
| Reports: own/team/all | view team ✅ (perm `reports.view_team` `src/lib/permissions.ts:136`; UI `src/app/reports/page.tsx:16-20`) |
| Audit log access | ❌ (requires `reports.view_all`; HR only has `reports.view_team` `src/lib/permissions.ts:136`; audit gate `src/app/audit/page.tsx:20-22`) |

#### Role: Engineering / Staff
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ✅ (roles defined) Engineering `src/lib/permissions.ts:123-131`; Staff `src/lib/permissions.ts:213-223` |
| Can view dashboard (scope) | ✅ (perm `dashboard.view` in both roles `src/lib/permissions.ts:124` and `src/lib/permissions.ts:214`; dashboard auth `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | submit ✅ (perm `expenses.submit` Engineering `src/lib/permissions.ts:126` / Staff `src/lib/permissions.ts:216`; API `src/app/api/expenses/route.ts:166-168`)<br>edit ❌ (no `expenses.edit` in either list; API `src/app/api/expenses/[id]/route.ts:24-27`)<br>approve ❌ (no approvals perms in either list; API `src/app/api/approvals/route.ts:16-24`)<br>mark paid ❌ (no `expenses.mark_paid`; API `src/app/api/expenses/[id]/mark-as-paid/route.ts:17-19`)<br>export ✅ (perm `expenses.view_own` Engineering `src/lib/permissions.ts:125` / Staff `src/lib/permissions.ts:215`; API `src/app/api/expenses/export/route.ts:26-31`) |
| Income: create/edit/approve/export | Engineering: create ❌ (no `income.add` in Engineering list `src/lib/permissions.ts:123-131`); Staff: create ❌ (no `income.add` in Staff list `src/lib/permissions.ts:213-223`); API `src/app/api/income/route.ts:54-56`<br>edit ❌ (no `income.edit`; API `src/app/api/income/[id]/route.ts:23-27`)<br>approve ❌ (no approvals perms; API `src/app/api/approvals/route.ts:16-24`)<br>export ✅ for Staff only (perm `income.view_own` Staff `src/lib/permissions.ts:217`; API `src/app/api/income/export/route.ts:26-31`); Engineering ❌ (no `income.view_own` in Engineering list) |
| Projects: create/edit/assigned view/financials | create/edit ❌ (no `projects.edit` in either list; API `src/app/api/projects/route.ts:35-38`)<br>assigned view ✅ (perm `projects.view_assigned` Engineering `src/lib/permissions.ts:129` / Staff `src/lib/permissions.ts:220`; API `src/app/api/projects/route.ts:16-19`)<br>financials ✅ (perm `projects.view_assigned` in both lists; API `src/app/api/projects/financial/route.ts:12-16`) |
| Inventory: view/adjust/ledger export | view ✅ (perm `inventory.view` Engineering `src/lib/permissions.ts:127` / Staff `src/lib/permissions.ts:218`; API `src/app/api/inventory/route.ts:16-18`)<br>adjust ❌ (no `inventory.adjust` in either list; API `src/app/api/inventory/route.ts:31-33`)<br>ledger export ✅ (perm `inventory.view` in both lists; API `src/app/api/inventory/ledger/export/route.ts:24-28`) |
| Employees: view own/team/all; wallet view/edit | Engineering: view ❌ (no `employees.view_*` in Engineering list `src/lib/permissions.ts:123-131`); Staff: view own ✅ (perm `employees.view_own` `src/lib/permissions.ts:222`; UI `src/app/employees/page.tsx:22-24`)<br>wallet view/edit ❌ for both (no `employees.edit_wallet`; wallet UI/API `src/app/wallets/page.tsx:22-24`, `src/app/api/employees/wallet/route.ts:15-17`) |
| Reports: own/team/all | view own ✅ (perm `reports.view_own` Engineering `src/lib/permissions.ts:130` / Staff `src/lib/permissions.ts:221`; UI `src/app/reports/page.tsx:16-20`) |
| Audit log access | ❌ (requires `reports.view_all`; neither role has it `src/lib/permissions.ts:123-131` / `src/lib/permissions.ts:213-223`; audit gate `src/app/audit/page.tsx:20-22`) |

#### Role: Auditor / Read-only
| Capability | Status (✅/❌ + evidence) |
| --- | --- |
| Can login | ❌ (Auditor role not defined; closest is `Guest`) `src/lib/permissions.ts:224` and `src/lib/permissions.ts:227-228` |
| Can view dashboard (scope) | ✅ for Guest only (perm `dashboard.view` `src/lib/permissions.ts:224`; dashboard auth `src/app/api/dashboard/route.ts:5-9`) |
| Expenses: create/submit/edit/approve/mark paid/export | ❌ (Guest has only `dashboard.view`; no expenses perms) `src/lib/permissions.ts:224` |
| Income: create/edit/approve/export | ❌ (Guest has only `dashboard.view`) `src/lib/permissions.ts:224` |
| Projects: create/edit/assigned view/financials | ❌ (Guest has only `dashboard.view`) `src/lib/permissions.ts:224` |
| Inventory: view/adjust/ledger export | ❌ (Guest has only `dashboard.view`) `src/lib/permissions.ts:224` |
| Employees: view own/team/all; wallet view/edit | ❌ (Guest has only `dashboard.view`) `src/lib/permissions.ts:224` |
| Reports: own/team/all | ❌ (Guest has only `dashboard.view`) `src/lib/permissions.ts:224` |
| Audit log access | ❌ (requires `reports.view_all`; Guest only has `dashboard.view`) `src/lib/permissions.ts:224` and `src/app/audit/page.tsx:20-22` |

### 5) Data integrity invariants
| Invariant | API enforcement | UI enforcement |
| --- | --- | --- |
| Expense amount must be positive | ✅ `src/lib/validation.ts:3-8` (“amount: z.number().positive()”) | ❌ `src/components/ExpenseFormDialog.tsx:353-363` (amount input has no `min`) + `src/components/ExpenseFormDialog.tsx:156-165` (submit uses `parseFloat` without positivity check) |
| Income amount must be positive | ✅ `src/lib/validation.ts:23-29` (“amount: z.number().positive()”) | ❌ `src/components/IncomeFormDialog.tsx:130-140` (amount input has no `min`) + `src/components/IncomeFormDialog.tsx:42-50` (submit uses `parseFloat` without positivity check) |
| Project required for company expenses | ✅ `src/app/api/expenses/route.ts:197-202` (company expense requires project) + `src/app/api/expenses/[id]/route.ts:69-78` (edit enforces project) | ✅ `src/components/ExpenseFormDialog.tsx:130-135` (client-side check before submit) |
| Inventory purchase requires qty when linking | ✅ `src/app/api/expenses/route.ts:204-208` (inventory qty required when linking purchase) | ✅ `src/components/ExpenseFormDialog.tsx:137-145` (client-side required item + qty) |
| Receipt required for expense ≥ threshold | ✅ `src/lib/constants.ts:1` (threshold) + `src/app/api/expenses/route.ts:226-234` + `src/app/api/expenses/[id]/route.ts:100-110` | ❌ `src/components/ExpenseFormDialog.tsx:147-177` (no receipt-threshold validation before submit) |
| Wallet balance/hold cannot go negative | ✅ `src/app/api/employees/wallet/route.ts:38-46` + `src/app/api/expenses/route.ts:338-346` + `src/app/api/expenses/[id]/route.ts:130-139` | ❌ `src/components/ExpenseFormDialog.tsx:156-175` (payload has no `paymentSource` or balance check) |
| Approval levels/thresholds drive status | ✅ `src/lib/constants.ts:4-13` + `src/lib/approvals.ts:6-18` + `src/app/api/expenses/route.ts:289-291` + `src/app/api/income/route.ts:81-105` | ❌ `src/components/ExpenseFormDialog.tsx:156-175` + `src/components/IncomeFormDialog.tsx:42-55` (no approval-level logic before submit) |
| Mark-as-paid only after approval | ✅ `src/app/api/expenses/[id]/mark-as-paid/route.ts:30-34` | ✅ `src/components/ApprovalActions.tsx:270-277` (button only when `status === "APPROVED"`) |

### 6) Testing reality check (no marketing)

#### 6.1 Existing tests (what they assert)
| Test file | What it asserts | Evidence |
| --- | --- | --- |
| `src/lib/__tests__/validation.test.ts` | Expense/income schema accept/reject; project required; invalid receipt URL rejected | `src/lib/__tests__/validation.test.ts:4-75` |
| `src/lib/__tests__/permissions.test.ts` | CEO wildcard; Staff expense permissions; wildcard permission behavior; invalid permission input | `src/lib/__tests__/permissions.test.ts:4-25` |
| `src/lib/__tests__/approvals.test.ts` | Approval level escalation; pending-status helpers; role-based approval logic | `src/lib/__tests__/approvals.test.ts:11-41` |
| `src/lib/__tests__/wallet.test.ts` | Wallet transaction rules: missing employee; negative/hold checks; credit via transaction | `src/lib/__tests__/wallet.test.ts:25-89` |
| `src/lib/__tests__/format.test.ts` | `formatMoney` output for positive/negative/zero | `src/lib/__tests__/format.test.ts:1-8` |
| `playwright/tests/login.spec.ts` | Login page renders; Google button conditional; email/password inputs visible | `playwright/tests/login.spec.ts:3-16` |
| `playwright/tests/auth.spec.ts` | Register + login flow; existing-user login; invalid creds; duplicate email; email/password validation; Google button visibility | `playwright/tests/auth.spec.ts:5-131` |
| `playwright/tests/smoke-all-pages.spec.ts` | Authenticated smoke test loads route list; checks HTTP status and error overlays | `playwright/tests/smoke-all-pages.spec.ts:10-62` |
| `playwright/tests/refrens-audit.spec.ts` | Refrens crawl with env creds; collects titles/headings; writes output files | `playwright/tests/refrens-audit.spec.ts:18-151` |

#### 6.2 Proposed test plan (unit → integration → Playwright)
- Unit: add tests for approval-engine thresholds + role gating (logic currently in `src/lib/approval-engine.ts:5-76`) and wallet helper invariants (logic in `src/lib/wallet.ts:4-46`).
- Integration: add API tests for expense/income create/edit validation + approval/status transitions (`src/app/api/expenses/route.ts:159-291`, `src/app/api/expenses/[id]/route.ts:30-117`, `src/app/api/income/route.ts:60-105`, `src/app/api/income/[id]/route.ts:29-77`).
- Playwright: add end-to-end flows for expense submit → approval → mark-as-paid (`src/components/ExpenseFormDialog.tsx:124-177`, `src/components/ApprovalActions.tsx:122-277`) and inventory ledger movements (`src/components/InventoryLedgerDialog.tsx:49-90`, `src/components/InventoryTable.tsx:80-107`).

### 7) Prioritized backlog

#### Critical
| Item | Impact | Exact files | Fix steps | Evidence |
| --- | --- | --- | --- | --- |
| Invoice create UI/API mismatch | UI submits `invoiceNumber/clientName/issueDate` but API expects `invoiceNo/projectId/date`; create fails validation | `src/components/InvoiceFormDialog.tsx`, `src/lib/validation.ts`, `src/app/api/invoices/route.ts` | Align UI payload to `invoiceSchema` (or update schema/API to accept current UI fields) and map to project/client correctly | `src/components/InvoiceFormDialog.tsx:31-46` (payload fields) + `src/lib/validation.ts:107-114` (invoice schema) + `src/app/api/invoices/route.ts:37-64` (expects `invoiceNo/projectId`) |
| Approvals GET missing permission gate | Any authenticated user can access pending approvals + stats without approval permissions | `src/app/api/approvals/route.ts` | Add permission check (e.g., `approvals.view` / `expenses.approve_*`) before returning approvals/stats | `src/app/api/approvals/route.ts:30-53` (GET only checks auth) |
| Public self‑registration enabled | `/api/register` allows unauthenticated account creation (production risk) | `src/app/api/register/route.ts` | Restrict to admin-only or gated invites; disable in production | `src/app/api/register/route.ts:12-55` (no auth/permission checks) |

#### High
| Item | Impact | Exact files | Fix steps | Evidence |
| --- | --- | --- | --- | --- |
| Project financials ignore scope | Users with `projects.view_assigned` can see all project financials | `src/app/api/projects/financial/route.ts` | Add scope filter when only `view_assigned` is present (filter by assigned projects/owner) | `src/app/api/projects/financial/route.ts:12-27` (perm check) + `src/app/api/projects/financial/route.ts:21-27` (no `where` filter) |
| Dashboard API lacks permission check | Any authenticated user can read company-wide totals | `src/app/api/dashboard/route.ts` | Require `dashboard.view` and apply scope (own/team/all) before aggregates | `src/app/api/dashboard/route.ts:5-40` (auth only; no permission/scope) |
| Attachments missing parent-entity authorization | User with attachment edit can bind any `recordId` without verifying parent ownership | `src/app/api/attachments/route.ts`, `src/app/api/attachments/[id]/route.ts` | Validate parent record access before create/update/delete; restrict `recordId` by type + scope | `src/app/api/attachments/route.ts:27-57` (accepts `recordId` blindly) + `src/app/api/attachments/[id]/route.ts:7-27` (updates without parent check) |

#### Medium
| Item | Impact | Exact files | Fix steps | Evidence |
| --- | --- | --- | --- | --- |
| Categories list readable without auth | Unauthenticated requests can fetch categories (taxonomy leak) | `src/app/api/categories/route.ts` | Require auth; return 401 when no session | `src/app/api/categories/route.ts:6-18` (auth optional; only checks perms when session exists) |
| Income UI lacks edit/delete actions | Income can be edited/deleted via API but UI has no actions (operational gap) | `src/app/income/page.tsx`, `src/app/api/income/[id]/route.ts` | Add edit/delete UI with permission gates and form prefill | `src/app/income/page.tsx:119-145` (table has no actions) + `src/app/api/income/[id]/route.ts:11-148` (PATCH/DELETE exist) |
| QuickEdit prompt used for finance‑critical edits | Prompt-based edits bypass structured validation UX | `src/components/TableActions.tsx`, `src/components/InventoryTable.tsx`, `src/components/EmployeesTable.tsx`, `src/app/clients/page.tsx` | Replace QuickEdit with structured edit dialogs and field validation | `src/components/TableActions.tsx:27-50` (prompt-based edit) + `src/components/InventoryTable.tsx:98-106` + `src/components/EmployeesTable.tsx:91-95` + `src/app/clients/page.tsx:111-115` |
