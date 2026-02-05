# AutoMatrix ERP — Master Plan (C&I Engineering)

**Purpose:** Build a clean, role‑based ERP for a C&I (Commercial & Industrial) engineering company.  
**Focus:** Project-centric operations with strict role permissions, auditable transactions, and simple CRUD for every module.

---

## 0) Current Status (Audit V2 baseline — Feb 5, 2026)

**Summary:** Core modules exist but the system is **not production‑ready**. Audit V2 identified critical mismatches and security gaps that must be resolved before rollout.

**Critical gaps to fix first (status)**
1. Invoice create UI/API mismatch — **Resolved** (Create/Edit forms aligned with API/schema).
2. Approvals GET route lacks permission gate — **Resolved** (permission + assignment checks enforced).
3. Public self‑registration enabled in `/api/register` — **Resolved** (admin‑only, login page no longer shows self‑register).

**High‑priority gaps (status)**
- Dashboard API lacks permission/scope enforcement — **Resolved** (role‑scoped metrics).
- Project financials ignore assigned‑project scope — **Open**.
- Attachments API does not verify parent‑record authorization — **Resolved** (type + ownership checks).

**Medium gaps**
- Categories list readable without auth.
- Income UI missing edit/delete actions.
- QuickEdit prompt‑based edits in finance‑critical tables.

This section is the baseline for tracking what is fixed and what remains.

## 1) Vision & Principles

**Vision:** One reliable system to manage projects, expenses, inventory, wallets, approvals, and reporting for engineering work.

**Principles**
- Single source of truth (no shadow spreadsheets).
- Role‑based access for each module and field (prices, approvals, wallet, etc.).
- Every financial action is auditable.
- Keep UI simple and consistent; avoid “smart” behavior that hides data.

---

## 2) Core Modules (Must Have)

**Master Data (CRUD)**
- Clients (with contacts)
- Projects (linked to clients)
- Employees
- Inventory Items
- Expense Categories
- Payment Modes / Sources

**Transactions (CRUD)**
- Expenses (linked to project + employee)
- Income / Payments (linked to project)
- Inventory Ledger (stock in/out with references)
- Employee Wallet (credit/debit with audit)

**Operations**
- Approvals (expense + income)
- Project‑wise expenses and recovery tracking
- Attachments (receipts, invoices)

**Reporting (initial)**
- Project summary (budget vs actual, pending recovery)
- Expense by project / category
- Inventory stock report
- Employee wallet summary

---

## 3) Roles & Access (C&I focused)

**CEO**
- Full access

**Admin**
- User management, roles, system settings

**Finance / Accounts**
- Full financial view, approvals, wallet transfers, reports

**Procurement**
- Inventory CRUD + purchase price entry

**Store Keeper**
- Stock in/out, view quantities, no purchase cost edit

**Sales**
- Can view selling price and project pipeline

**Marketing / Sales Manager**
- Can update project status, payment received, recovery

**Engineering / Project Manager**
- Can create/update project info, view project expenses

**Employee**
- Can submit expenses, view own wallet

**Field‑level access must be enforced** (e.g., purchase price only visible/editable to Procurement/Finance, selling price visible to Sales/Marketing).  

---

## 4) Immediate Scope (Phase 0: Stabilize)

**Goal:** Make the system usable for daily operations without gaps.

**Deliverables**
1. Align all forms ↔ API ↔ DB schema (no mismatches).
2. CRUD works for:
   - Clients, Projects, Employees, Inventory Items
   - Expenses, Income, Approvals
   - Employee Wallet transactions
3. Permissions enforced for all modules (read/write/approve).
4. Audit logs for all create/update/delete.

**Success Criteria**
- No 400/500 errors for standard CRUD.
- All required fields match real business workflow.
- Role permissions actually restrict access.

---

## 5) Phase 1: Core Operations

**Clients**
- Create client + contacts
- Client dropdown in Project form with “Create Client” option

**Projects**
- Project ID (from quotation)
- Client (required)
- Start Date
- Total Budget (approved/settled amount)

**Expenses**
- Employee submits expense against project + category
- Receipt attachment
- Approval workflow
- Owner Personal expense type (no project)
- Company expense requires project

**Inventory**
- Items with purchase + selling price
- Ledger (stock in/out, project reference)
- Purchase price captured on stock-in
- Project allocation moves cost from store to project

**Material Purchase Flow (Simple, Required)**
1) **Vendor Payment (Expense)**
   - Category: *Material (Stock/Inventory)* or *Material (Project Direct)*
   - Payment Source: Company/Wallet
2) **Inventory Stock-In**
   - Item, quantity, unit cost, vendor reference
3) **Project Allocation (Stock-Out)**
   - Move quantity to project (actual project cost)

**Rule**
- If material is for a project and should be tracked by store, **always** do stock-in + project allocation.
- If material is direct-to-project and not stored, use *Material (Project Direct)* and skip stock allocation.

**Employee Wallet**
- Finance credits wallet
- Employee logs expenses using wallet

**Payroll & Incentives (Planned)**
- Maintain role-based incentive defaults (Engineer/Technician/Helper) with per-employee overrides.
- Record project-linked incentives per employee.
- Allow deductions with reason + approval (quality/performance).
- Monthly payroll run (previous month only): base salary + incentives − deductions.
- Auto-credit wallet on payroll approval + salary ledger entry.
- Salary advances with approval (credited to wallet).

**Employee Self‑Service (Must Have)**
- View salary history (base + incentive + deductions) by pay period.
- View incentive history per project.
- View wallet transfers (credits/debits), running balance, and holds.
- View expenses paid from wallet with status (approved / pending / rejected).
- Export own wallet and salary history (CSV).

**Implementation Breakdown (Next)**
1) Data Models
   - CompensationPolicy (role default incentive)
   - EmployeeCompensation (base salary + overrides)
   - IncentiveEntry (project-linked incentive with approval)
   - PayrollRun + PayrollEntry (pay period + payout lines)
2) API + RBAC
   - Incentives CRUD + approve
   - Payroll runs CRUD + approve (wallet credit on approval)
3) UI
   - Incentive manager (Finance/HR)
   - Payroll run builder + approval
   - Employee self dashboard (salary/incentive/wallet history)
4) Reporting
   - Payroll summary by period
   - Incentives by project/employee
5) Audit
   - Audit log on all incentive + payroll changes

**Implementation Progress**
- Data Models → Done
- API + RBAC → Done
- UI → Done (Incentives + Payroll + Employee Self exports)
 - Salary Advances → Done

---

## 11) HR + Finance Flow (Required for ERP‑Correct Accounting)

**Employee Master Profile (HR)**
- Personal profile (CNIC, address, phone, education, experience).
- Company profile: department, designation, reporting officer, join date, status.
- Salary package: base salary, allowances, default incentive role.

**Payroll Accounting (Finance)**
- Payroll run creates **company expense** records (Salary Expense).
- Wallet credit is the **payment** record, not the expense itself.
- Each payroll entry must store deduction reason (required if > 0).
- Payroll runs are **previous month only** and must not overlap.

**Incentives Accounting (Project + Finance)**
- Incentives are only allowed after project status is **Completed/Closed**.
- Incentive approval creates **project expense** + wallet credit.
- Deductions or adjustments require reason + approval history.

**Commissions**
- Commission entries are expenses with % basis and history.
- Must link to project or sales reference and be auditable.

**Role‑Assignable Approvals**
- Incentive/deduction approvers must be assignable by role (future RBAC management UI).

---

## 12) Comprehensive ERP Plan (Modular + Scalable)

### A) Module Map (Primary)
1. **HR & Admin**
   - Employee Master Profile
   - Department/Designation
   - Reporting Officer
   - Salary Package (base + allowances)
   - Salary Advances
2. **Finance & Accounts**
   - Expenses (all types)
   - Payroll (monthly, previous month only)
   - Incentives (project‑based, completion‑only)
   - Wallet Ledger (employee payments)
   - Income/Receipts
   - Approvals
3. **Projects / Engineering**
   - Projects (status: Not Started/Upcoming, Active, On Hold, Completed, Closed)
   - Project Financials (budget vs actual)
   - Project Income / Expense view
4. **Procurement / Store**
   - Purchase Orders (PO)
   - Goods Receipts (GRN)
   - Vendor records
5. **Inventory**
   - Inventory Items
   - Stock In/Out (ledger)
   - Last Purchase Price + Avg Cost + Stock Value
6. **CRM / Sales**
   - Clients
   - Quotations
   - Invoices
   - Commissions (profit or sales %)

---

### B) Page & Form Structure (Nested + Modular)
**Sidebar (Top‑level)**
- Dashboard
- HR
- Finance
- Projects
- Procurement
- Inventory
- CRM
- Reports
- Settings

**Nested Pages**
**HR**
- Employees
- Departments/Designations
- Salary Advances

**Finance**
- Expenses
- Payroll
- Incentives
- Wallet Ledger
- Income/Receipts
- Approvals

**Projects**
- Projects
- Project Financials

**Procurement**
- Purchase Orders
- Goods Receipts

**Inventory**
- Items
- Ledger

**CRM**
- Clients
- Quotations
- Invoices
- Commissions

---

### C) Module Requirements (Key Rules)

**HR**
- Full employee profile: personal info, education, experience, department, designation, reporting officer.
- Salary package stored per employee.
- Employee status: Active/Inactive/On Hold.

**Finance**
- Expense form must handle: salary, incentive, commission, procurement, project costs.
- Salary expense = company expense, always in ledger.
- Incentive expense = project expense, only after project completion.
- Deductions require **reason + approval**.

**Projects**
- Project status must be enforced: Not Started/Upcoming → Active → Completed/Closed.
- Incentives only allowed after Completed/Closed.

**Procurement & Inventory**
- PO → GRN → Stock In (ledger).
- Last purchase price and average cost updated on stock in.

**CRM**
- Commission entries must be linked to sales/project and be auditable.

---

### D) Cross‑Module Integrations (ERP Flow)

1. **Payroll Approval**
   - Creates company salary expense
   - Credits employee wallet

2. **Incentive Approval**
   - Creates project expense
   - Credits employee wallet

3. **Salary Advance Approval**
   - Credits wallet
   - Logged separately, can be reconciled in payroll

4. **Project Completion**
   - Unlocks incentive creation

5. **Procurement**
   - PO → GRN → Inventory ledger updates → project cost allocation

---

### E) Scalability (200+ Employees)

- Department‑level approvals (manager first, directors/CEO escalation).
- Server‑side pagination/search/filter everywhere.
- Indexes on employeeId, projectId, status, date.
- Bulk payroll generation by department/role templates.


---

## 6) Phase 2: Approvals & Reporting

**Approvals**
- Expense approvals
- Income approvals
- Approval history + audit logs

**Reporting**
- Project‑wise expense summary
- Project recovery (received vs pending)
- Inventory valuation
- Employee expense summary

---

## 7) Phase 3: Attachments & Notifications

- Receipt upload + preview
- Attachment permissions by parent record
- Notifications for approvals, low stock, overdue invoices

---

## 8) Phase 4: Future Expansion (Optional)

- Procurement workflow (PO, GRN)
- Advanced inventory costing (FIFO/Avg)
- Maintenance/service module
- Client portal
- Automated billing and invoicing

---

## 9) Execution Rules (Non‑negotiable)

- No feature without CRUD working end‑to‑end.
- No UI without validation & permission checks in API.
- All monetary changes must have audit logs.
- Keep workflows simple before adding automation.

---

## 10) Master Plan Status Tracker (Living)

Update this as we ship changes. Format: **Item → Status → Evidence (PR/commit/notes)**.

**Critical**
- Invoice create alignment (UI/API/schema) → Done → `src/components/InvoiceFormDialog.tsx` aligned with API/schema
- Approvals GET permission gate → Done → `src/app/api/approvals/route.ts` added role-based gate
- Lock down `/api/register` → Done → `src/app/api/register/route.ts` now requires auth + elevated permission

**High**
- Dashboard API permission + scope → Done → `src/app/api/dashboard/route.ts` + scoped metrics in `src/lib/dashboard.ts`
- Project financials scope filter → Done → `src/app/api/projects/financial/route.ts`
- Attachment parent‑auth enforcement → Done → `src/app/api/attachments/route.ts` and `src/app/api/attachments/[id]/route.ts`

**Medium**
- Auth required for categories GET → Done → `src/app/api/categories/route.ts`
- Income edit/delete UI → Done → `src/app/income/page.tsx` + `src/components/IncomeEditDialog.tsx`
- Replace QuickEdit prompts with structured dialogs → Done → `src/components/*Actions.tsx` + edit dialogs (expenses/inventory/employees/clients/invoices/attachments/notifications)
- Decimal serialization warnings (Prisma Decimal → number) → Done → `src/app/income/page.tsx` + `src/app/invoices/page.tsx` + `src/app/inventory/page.tsx`
- Next config dev root/allowed origins → Done → `next.config.ts`
- Inventory price field‑level access (view/edit) → Done → `src/app/api/inventory/route.ts` + `src/app/api/inventory/[id]/route.ts` + `src/components/InventoryFormDialog.tsx`
- Add Store Keeper role permissions → Done → `src/lib/permissions.ts`
- Employee expense summary report → Done → `src/app/reports/employee-expenses/page.tsx` + `src/app/reports/page.tsx`
- Reports scope enforcement (expenses/projects/inventory/wallets) → Done → `src/app/reports/expenses/page.tsx` + `src/app/reports/projects/page.tsx` + `src/app/reports/inventory/page.tsx` + `src/app/reports/wallets/page.tsx`
- Employee expense summary export → Done → `src/app/api/reports/employee-expenses/export/route.ts`
- Project report export → Done → `src/app/api/reports/projects/export/route.ts` + `src/app/reports/projects/page.tsx`
- Inventory report export → Done → `src/app/api/reports/inventory/export/route.ts` + `src/app/reports/inventory/page.tsx`
- Low stock notifications → Done → `src/app/api/inventory/ledger/route.ts`
- Overdue invoice notifications → Done → `src/app/api/invoices/[id]/route.ts`
- Attachment edit preview + type select → Done → `src/components/AttachmentEditDialog.tsx`
- Notifications UX (badges + mark read) → Done → `src/app/notifications/page.tsx` + `src/components/NotificationActions.tsx`
- Approvals UX filters/search → Done → `src/components/ApprovalQueue.tsx`
- Reports UX polish (badges/highlights) → Done → `src/app/reports/expenses/page.tsx` + `src/app/reports/inventory/page.tsx` + `src/app/reports/wallets/page.tsx`
- Approval engine pending status handling + validation fix → Done → `src/lib/approval-engine.ts` + `src/lib/validation-schemas.ts`
- Approval flow test (create expense → approve) → Done → `playwright/tests/approval-flow.spec.ts`
- Phase 4 kickoff: Procurement summary report → Done → `src/app/reports/procurement/page.tsx` + `src/app/reports/page.tsx`
- Procurement export + filters → Done → `src/app/api/reports/procurement/export/route.ts` + `src/app/reports/procurement/page.tsx`
- Procurement export (PO/GRN CSV + project/vendor filters) → Done → `src/app/api/reports/procurement/po-export/route.ts` + `src/app/api/reports/procurement/grn-export/route.ts`
- Procurement alerts (spend spike + missing stock-in) → Done → `src/app/api/expenses/route.ts`
- PO/GRN module (schema + CRUD) → Done → `prisma/schema.prisma` + `src/app/procurement/purchase-orders/page.tsx` + `src/app/procurement/grn/page.tsx` + `src/app/api/procurement/*`
- PO↔GRN linkage + inventory stock-in → Done → `src/app/api/procurement/grn/route.ts` + `src/app/api/procurement/grn/[id]/route.ts` + `prisma/schema.prisma`
- Employee self dashboard (wallet + expenses) → Done → `src/app/me/page.tsx` + `src/components/Sidebar.tsx`
