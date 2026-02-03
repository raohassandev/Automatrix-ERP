# AutoMatrix ERP — Master Plan (C&I Engineering)

**Purpose:** Build a clean, role‑based ERP for a C&I (Commercial & Industrial) engineering company.  
**Focus:** Project-centric operations with strict role permissions, auditable transactions, and simple CRUD for every module.

---

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

**Inventory**
- Items with purchase + selling price
- Ledger (stock in/out, project reference)

**Employee Wallet**
- Finance credits wallet
- Employee logs expenses using wallet

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

