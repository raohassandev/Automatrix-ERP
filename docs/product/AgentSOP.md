# Agent SOP - Next.js Development
## Standard Operating Procedures for AI Agent - AutoMatrix ERP (Next.js)

**Project:** AutoMatrix ERP (Next.js Migration)  
**Platform:** Next.js + Postgres  
**Purpose:** Execution manual for building the ERP web app  
**Last Updated:** January 27, 2026

---

## TABLE OF CONTENTS
1. Scope & Operating Principles
2. Local Environment Setup
3. Architecture & Structure
4. Coding Standards
5. Feature Delivery Workflow
6. Security & Permissions
7. Data Model & Migrations
8. Testing & QA
9. Deployment & Operations
10. Troubleshooting

---

## 1) SCOPE & OPERATING PRINCIPLES

### 1.1 Goals
- Build a production-grade ERP web app with full RBAC, auditability, and data integrity.
- Replace Apps Script UI and consolidate logic in Next.js.
- Preserve and extend existing ERP functionality (expenses, income, approvals, inventory, projects, employees, invoices, attachments, notifications, audit log, reports).

### 1.2 Non-Goals
- No direct Apps Script UI reuse.
- No direct Google Sheet runtime dependencies in production (Sheets only for migration).

### 1.3 Execution Rules
- Always keep business logic on the server (API routes or server actions).
- Enforce permission checks at the API boundary and in the UI.
- Every mutation writes audit logs.
- Use transactions for financial/ledger updates.

---

## 2) LOCAL ENVIRONMENT SETUP

### 2.1 Requirements
- Node.js LTS
- Postgres
- pnpm or npm

### 2.2 Setup
```bash
pnpm install
cp .env.example .env.local
pnpm prisma migrate dev
pnpm dev
```

### 2.3 Standard Commands
```bash
pnpm lint
pnpm test
pnpm prisma studio
```

---

## 3) ARCHITECTURE & STRUCTURE

### 3.1 App Router Layout
```
/app
  /login
  /dashboard
  /expenses
  /income
  /approvals
  /inventory
  /projects
  /employees
  /invoices
  /reports
  /settings

/app/api
  /auth
  /expenses
  /income
  /approvals
  /inventory
  /projects
  /employees
  /invoices
  /attachments
  /audit
  /notifications
```

### 3.2 Core Domains
- Auth & RBAC
- Expenses + Income
- Approvals workflow
- Inventory + Ledger
- Projects & Financials
- Employees & Wallets
- Invoices
- Attachments
- Notifications
- Audit Log
- Reports

---

## 4) CODING STANDARDS

### 4.1 General
- TypeScript everywhere.
- No direct DB writes from the client.
- All side-effects go through service functions.
- Document every reusable component via inline JSDoc comments and pair it with `docs/API_DOCS_TEMPLATE.md`.

### 4.2 Validation
- Use schema validation (Zod or similar) at API boundaries.
- Server-side validation is mandatory even if UI validates.

### 4.3 Error Handling
- API returns structured errors: `{ success: false, error, details? }`.
- Log all errors server-side with context.

---

## 5) FEATURE DELIVERY WORKFLOW

### 5.1 Implementation Order
1. DB schema + Prisma models
2. Server-side services + RBAC checks
3. API routes / server actions
4. UI pages + components
5. Tests + audit logging

### 5.2 Mandatory Checklist (Per Feature)
- Permission checks applied
- Validation implemented
- Audit log entry created on mutation
- UI and API aligned with schema
- Tests updated
- Components used across multiple pages must be reusable, documented, and referenced in `PROJECT_BOARD.md` so future agents can wire them without duplication.

---

## 6) SECURITY & PERMISSIONS

### 6.1 RBAC
- Roles: Owner, CEO, Finance Manager, Manager, Staff, Guest
- Permission checks at API routes and sensitive UI sections

### 6.2 Data Access Rules
- Users can only view/edit resources they own unless role allows broader access.
- Finance roles can see all financial data.

---

## 7) DATA MODEL & MIGRATIONS

### 7.1 Core Entities
- User, Role, Permission
- Expense, Income
- Approval
- InventoryItem, InventoryLedger
- Project
- Employee, WalletLedger
- Invoice
- Attachment
- AuditLog
- Notification

### 7.2 Migrations
- Use Prisma migrations only.
- Migration scripts for legacy Google Sheets must be idempotent.

---

## 8) TESTING & QA

### 8.1 Testing Layers
- Unit tests for business logic
- Integration tests for API routes
- Smoke tests for key workflows

### 8.2 Core Flows to Validate
- Expense submit → approval → wallet update
- Income submit → approval
- Inventory ledger updates and stock balance
- Project profitability calculations
- RBAC enforcement

---

## 9) DEPLOYMENT & OPERATIONS

### 9.1 Deployment
- Vercel or server deployment for Next.js
- Managed Postgres

### 9.2 Scheduled Jobs
- Daily digest notifications
- Reminder jobs for overdue invoices and approvals

---

## 10) TROUBLESHOOTING

### 10.1 Common Issues
- **Auth issues:** verify NextAuth callbacks and provider config.
- **Permission denial:** check role mapping and permission matrix.
- **Ledger mismatch:** verify transaction usage and audit logs.

### 10.2 Debug Steps
- Review server logs.
- Check audit logs for recent mutations.
- Verify DB transaction boundaries.

---

## APPENDIX: CORE FUNCTIONALITY LIST

- Auth + RBAC
- Dashboard KPIs and trends
- Expenses module (submit, approval, export)
- Income module
- Approvals queue
- Inventory ledger
- Projects + recovery
- Employees + wallets
- Invoices
- Attachments
- Notifications
- Audit trail
- Reports
