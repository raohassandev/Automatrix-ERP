# AutoMatrix ERP - Next.js Master Plan
## Enterprise-Grade Web App Roadmap

**Version:** 1.0  
**Date:** January 27, 2026  
**Status:** Planning

---

## Executive Summary
Build AutoMatrix ERP as a modern, scalable Next.js application with secure RBAC, real-time workflows, ledger-grade inventory, and enterprise reporting. The app replaces Apps Script UI and centralizes business logic in a full-stack web platform.

---

## Goals
- Deliver a production-ready ERP web app with multi-tenant-ready architecture.
- Preserve and expand existing ERP modules: expenses, income, approvals, inventory, projects, employees, attachments, audit logs, notifications.
- Provide strong data integrity, auditability, and traceability.

---

## Functional Scope (All Modules)

### 1) Authentication & RBAC
- Email/password + OAuth (Google) login
- Role hierarchy: Owner, CEO, Finance Manager, Manager, Staff, Guest
- Permission matrix (module/action level)
- Fine-grained access controls per resource

### 2) Dashboard
- KPIs (net profit, pending recovery, wallet balances)
- Date-range filters and comparisons
- Trends and sparklines
- Recent activity feed (audit log)
- Alerts: low stock, pending approvals

### 3) Expenses
- Submit expense with validation
- Multi-level approval routing by threshold
- Duplicate detection
- CRUD for pending expenses
- Filters: date, category, project, status, amount, search
- Receipt attachments
- Export to CSV

### 4) Income
- Log income/payments
- Approval workflow for large amounts
- Filters and summaries
- Link to invoices and projects
- Export to CSV

### 5) Approvals
- Unified pending approvals queue
- Approve/reject/partial approve
- Approval SLA tracking
- Notification on action
- Audit trail for all decisions

### 6) Inventory & Ledger
- Item master and categories
- IN/OUT ledger entries
- Running balance per item
- Low stock alerts + reorder thresholds
- Inventory adjustments with reasons
- Stock valuation and usage stats

### 7) Projects & Financials
- Project master (client, start/end, status)
- Contract value, invoiced, received, pending recovery
- Expense allocation and profitability
- Aging reports by client/project

### 8) Employees & Wallets
- Employee directory + roles
- Wallet balances with ledger entries
- Credits/debits tied to approvals
- Employee status (active/inactive)

### 9) Invoices
- Invoice creation and tracking
- Status flow: draft → sent → paid/overdue
- Due date and payment date

### 10) Attachments
- File upload (receipts, invoices, docs)
- External link support
- Storage provider (S3/Drive-compatible)
- Metadata and access control

### 11) Notifications
- Email + in-app notifications
- Daily digest
- Urgent alerts (high amounts)
- Reminder schedule (7/14/30 days)

### 12) Audit Trail
- Record-level audit logging
- Who/what/when/old/new values
- Filterable audit log viewer

### 13) Reports
- Financial summaries (income/expense, profit)
- Category breakdowns
- Approval turnaround time
- Inventory valuation

---

## Proposed Tech Stack
- **Frontend:** Next.js (App Router), React, TypeScript
- **UI:** Tailwind CSS + shadcn/ui or MUI
- **Backend:** Next.js API routes / server actions
- **Auth:** NextAuth
- **DB:** Postgres + Prisma
- **File Storage:** S3-compatible (or Google Drive API)
- **Jobs:** Cron (Vercel/Cloud scheduler) for digests

---

## App Architecture

### Routes (App Router)
- `/login`
- `/dashboard`
- `/expenses` / `/expenses/new` / `/expenses/[id]`
- `/income` / `/income/new` / `/income/[id]`
- `/approvals`
- `/inventory` / `/inventory/[id]`
- `/projects` / `/projects/[id]`
- `/employees` / `/employees/[id]`
- `/invoices` / `/invoices/[id]`
- `/reports`
- `/settings`

### API Surface (Server Actions / REST)
- `POST /api/expenses` (submit)
- `PATCH /api/expenses/[id]` (update)
- `POST /api/approvals` (approve/reject)
- `POST /api/inventory/ledger` (stock movement)
- `POST /api/income` (record income)
- `GET /api/dashboard` (KPIs)

---

## Data Model (Core Entities)
- User, Role, Permission
- Project, Client
- Expense, Income
- Approval (Expense/Income)
- InventoryItem, InventoryLedger
- Employee, WalletLedger
- Invoice
- Attachment
- AuditLog
- Notification

---

## Migration Considerations
- Import from Google Sheets/Excel
- Normalize data into Postgres
- Map legacy statuses to new enums
- Preserve audit logs where possible

---

## Phased Delivery Plan

### Phase 1: Foundation
- App scaffold, auth, RBAC, DB schema
- Base layout + navigation

### Phase 2: Core Transactions
- Expenses + Income + Approvals

### Phase 3: Inventory + Projects
- Inventory ledger, projects financials

### Phase 4: Reporting + Notifications
- Reports, alerts, scheduled digests

### Phase 5: Polish
- Performance, audit UX, export tools

---

## Success Criteria
- Role-based access enforced end-to-end
- Approval workflows functional with audit trail
- Inventory ledger balances consistent
- Project profitability and recovery accurate
- Attachments stored securely with access control

