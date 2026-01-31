# AutoMatrix ERP - Professional Mini ERP Execution Plan

**Version:** 2.0  
**Date:** January 29, 2026  
**Status:** EXECUTION READY - For CODEX Implementation  
**Last Updated:** Post-Migration & Gap Analysis

---

## EXECUTIVE SUMMARY

This document provides a complete, prioritized, execution-ready roadmap to transform AutoMatrix ERP from a functional prototype into a **professional mini ERP system**. All tasks are marked as ✅ DONE or 🔲 TODO with clear acceptance criteria.

**Current State:** Basic CRUD operations working, real data imported, authentication functional.  
**Goal State:** Production-ready professional ERP with complete workflows, reporting, and enterprise features.

---

## PROJECT STATUS OVERVIEW

### Overall Completion: **35%**

| Category               | Status  | Completion |
| ---------------------- | ------- | ---------- |
| **Infrastructure**     | ✅ Done | 95%        |
| **Authentication**     | ✅ Done | 90%        |
| **Database Schema**    | ✅ Done | 85%        |
| **Data Migration**     | ✅ Done | 100%       |
| **Basic CRUD APIs**    | ✅ Done | 80%        |
| **Basic UI Pages**     | ✅ Done | 40%        |
| **Business Logic**     | 🔲 Todo | 20%        |
| **Approval Workflows** | 🔲 Todo | 10%        |
| **Reporting**          | 🔲 Todo | 5%         |
| **Notifications**      | 🔲 Todo | 0%         |
| **Security Hardening** | 🔲 Todo | 30%        |
| **Testing**            | 🔲 Todo | 5%         |
| **Documentation**      | 🔲 Todo | 20%        |

---

## CURRENT STATE SNAPSHOT

### ✅ **COMPLETED (What's Working)**

#### Core Infrastructure

- ✅ Next.js 16.1.5 App Router
- ✅ TypeScript with strict mode
- ✅ Tailwind CSS v4
- ✅ PostgreSQL database
- ✅ Prisma ORM v6.1.0
- ✅ ESLint configured and passing
- ✅ Build successful (36 routes)

#### Authentication & RBAC

- ✅ NextAuth v5 beta 30
- ✅ JWT session strategy
- ✅ Credentials provider (email/password)
- ✅ Google OAuth provider (configured, needs credentials)
- ✅ User registration with validation
- ✅ Password hashing (bcrypt)
- ✅ Role-based access control
- ✅ 6 roles: Owner, CEO, Finance Manager, Manager, Staff, Guest
- ✅ Permission matrix in `src/lib/permissions.ts`
- ✅ Middleware route protection

#### Database & Models

- ✅ User, Role models
- ✅ Employee model with wallet balance
- ✅ Project model (supports client + internal)
- ✅ Expense model with status
- ✅ Income model
- ✅ InventoryItem model
- ✅ InventoryLedger model
- ✅ WalletLedger model
- ✅ Invoice model
- ✅ Attachment model
- ✅ Notification model
- ✅ AuditLog model

#### Real Data Imported

- ✅ 13 users with accounts
- ✅ 13 employees
- ✅ 5 projects (2 client, 3 internal)
- ✅ 10 expenses (PKR 362,630)
- ✅ 2 income records (PKR 1,024,500)
- ✅ 3 inventory items
- ✅ 7 wallet transactions
- ✅ Net profit: PKR 661,870

#### API Routes (27 endpoints)

- ✅ `/api/register` - User registration
- ✅ `/api/auth/[...nextauth]` - Authentication
- ✅ `/api/expenses` + `/api/expenses/[id]` - Full CRUD
- ✅ `/api/expenses/export` - CSV export
- ✅ `/api/income` + `/api/income/[id]` - Full CRUD
- ✅ `/api/income/export` - CSV export
- ✅ `/api/projects` + `/api/projects/[id]` - Full CRUD
- ✅ `/api/employees` + `/api/employees/[id]` - Full CRUD
- ✅ `/api/employees/wallet` - Wallet operations
- ✅ `/api/inventory` + `/api/inventory/[id]` - Full CRUD
- ✅ `/api/inventory/ledger` - Ledger entries
- ✅ `/api/invoices` + `/api/invoices/[id]` - Full CRUD
- ✅ `/api/approvals` - Basic approval endpoint
- ✅ `/api/attachments` + `/api/attachments/[id]` - File management
- ✅ `/api/notifications` + `/api/notifications/[id]` - CRUD
- ✅ `/api/audit` - Audit log retrieval
- ✅ `/api/dashboard` - KPI endpoint
- ✅ `/api/reports/export` - Report export
- ✅ `/api/users/role` - Role assignment

#### UI Pages (15 pages)

- ✅ `/login` - Authentication page
- ✅ `/dashboard` - Main dashboard (basic)
- ✅ `/expenses` - Expenses list
- ✅ `/income` - Income list
- ✅ `/projects` - Projects list
- ✅ `/employees` - Employees list
- ✅ `/inventory` - Inventory list
- ✅ `/invoices` - Invoices list
- ✅ `/approvals` - Approvals queue
- ✅ `/attachments` - Attachments list
- ✅ `/notifications` - Notifications list
- ✅ `/audit` - Audit log viewer
- ✅ `/reports` - Reports page (placeholder)
- ✅ `/settings` - Settings page (role assignment)
- ✅ Home redirect to dashboard

#### Supporting Infrastructure

- ✅ Migration script for Excel data
- ✅ Seed script for initial data
- ✅ Comprehensive documentation (3 docs)
- ✅ Git repository with proper structure

---

## 🎯 EXECUTION ROADMAP - PHASED APPROACH

### 🧭 Current Sprint Stack (CODEX One-Pass Focus)

1. **SEC-001 / NEXTAUTH_SECRET rotation & `pnpm security:check`** – secure sessions and guard environment variables on every run.
2. **APR-002 / Approval automation UI reuse** – implement reusable approval card/form components, keep RBAC in middleware so every page shares the same logic.
3. **REP-001 / Dashboard KPIs + CSV polish** – wire the KPI data into Dashboard and ensure CSV exports for expenses/income/reports are consumable.
4. **DOC-002 / Component & API documentation** – update `docs/API_DOCS_TEMPLATE.md` and add inline docs to every new reusable component so future agents know how to use them.
5. **TEST-005 / Playwright auth/environment guard** – keep `pnpm test:e2e` running and tied to `pnpm security:check`.

This sprint advances security, approvals, reporting, documentation, and tests in one cohesive pass.

---

## 🔴 **PHASE 1: CRITICAL FIXES & SECURITY (Week 1-2)**

**Priority:** CRITICAL | **Duration:** 1-2 weeks | **Effort:** 40 hours

### Goal: Make system secure and fix critical issues

### 1.1 Security Hardening

**Status:** 🔲 TODO | **Priority:** 🔴 CRITICAL

#### Tasks:

- [ ] **SEC-001:** Replace NEXTAUTH_SECRET with secure random value
  - File: `.env.local`
  - Generate: `openssl rand -base64 32`
  - Update in production environment
  - **AC:** Secret is 32+ bytes, randomly generated

- [ ] **SEC-002:** Configure Google OAuth credentials
  - Get Client ID and Secret from Google Cloud Console
  - Add to `.env.local`
  - Test Google sign-in flow
  - **AC:** Users can sign in with Google

- [ ] **SEC-003:** Add rate limiting to API endpoints
  - Install: `next-rate-limit` or implement custom
  - Add middleware for rate limiting
  - Configure limits: 100 req/15min per IP
  - **AC:** API returns 429 after limit exceeded

- [ ] **SEC-004:** Add input sanitization
  - Install: `dompurify` for client, `validator` for server
  - Sanitize all user inputs
  - Prevent XSS attacks
  - **AC:** HTML/script tags are stripped

- [ ] **SEC-005:** Add file upload security
  - File type validation (whitelist)
  - File size limits (10MB max)
  - Virus scanning (optional: ClamAV)
  - **AC:** Only allowed file types accepted

- [ ] **SEC-006:** Add security headers
  - Implement in `middleware.ts`
  - Add: CSP, X-Frame-Options, X-Content-Type-Options
  - **AC:** Security headers present in response

### 1.2 Critical Bug Fixes

**Status:** 🔲 TODO | **Priority:** 🔴 CRITICAL

#### Tasks:

- [ ] **BUG-001:** Fix Approval table missing
  - Check if Approval model exists in schema
  - Create migration if needed
  - Link to Expense and Income models
  - **AC:** Approvals can be created and queried

- [ ] **BUG-002:** Fix empty Audit Logs
  - Implement audit logging middleware
  - Log all CREATE, UPDATE, DELETE operations
  - Store old/new values
  - **AC:** All mutations create audit log entries

- [ ] **BUG-003:** Fix empty Notifications
  - Create notification service
  - Trigger on key events (approval, status change)
  - Store in database
  - **AC:** Notifications created on events

- [ ] **BUG-004:** Fix empty Attachments
  - Implement file upload API
  - Store files in temp directory or S3
  - Link to parent entities
  - **AC:** Files can be uploaded and retrieved

### 1.3 Data Validation

**Status:** 🔲 TODO | **Priority:** 🔴 HIGH

#### Tasks:

- [ ] **VAL-001:** Add Zod validation schemas
  - Create schema for each model
  - Validate at API boundary
  - Return clear error messages
  - **AC:** Invalid data rejected with 400 error

- [ ] **VAL-002:** Add business rule validation
  - Expense amount > 0
  - Date cannot be future (for expenses)
  - Required fields enforced
  - **AC:** Business rules enforced

- [ ] **VAL-003:** Add duplicate detection
  - Check duplicate expenses (same amount, date, user)
  - Warn user before creating
  - **AC:** Duplicate warning shown

---

## 🟡 **PHASE 2: APPROVAL WORKFLOW (Week 3-4)**

**Priority:** HIGH | **Duration:** 2 weeks | **Effort:** 60 hours

### Goal: Implement complete multi-level approval system

### 2.1 Approval Engine

**Status:** 🔲 TODO | **Priority:** 🔴 HIGH

#### Tasks:

- [ ] **APR-001:** Create Approval workflow engine
  - File: `src/lib/approval-engine.ts`
  - Implement threshold-based routing
  - Support multi-level approvals
  - **AC:** Expenses routed based on amount

- [x] **APR-002:** Define approval thresholds and reusable approval UI
  - < 10,000: Auto-approve or Manager
  - 10,000-50,000: Manager approval; 50,000+ requires finance
  - Componentized approval table and action buttons now reused for expenses/income
  - **AC:** Thresholds reflected in RBAC checks and approvals share the same documented UI components

- [ ] **APR-003:** Implement approval status transitions
  - PENDING → APPROVED → PAID
  - PENDING → REJECTED
  - PENDING → PARTIALLY_APPROVED (for large amounts)
  - **AC:** Status changes tracked in audit log

- [ ] **APR-004:** Add approval delegation
  - User can delegate approvals to another user
  - Time-bound delegation
  - **AC:** Delegated user can approve on behalf

- [ ] **APR-005:** Implement approval SLA tracking
  - Track time to approval
  - Alert on overdue approvals (>24hrs)
  - **AC:** SLA metrics visible in dashboard

### 2.2 Wallet Automation

**Status:** 🔲 TODO | **Priority:** 🔴 HIGH

#### Tasks:

- [ ] **WAL-001:** Auto-deduct wallet on expense approval
  - When expense approved, deduct from employee wallet
  - Create WalletLedger entry (DEBIT)
  - Update employee.walletBalance
  - **AC:** Wallet balance updated automatically

- [ ] **WAL-002:** Wallet top-up workflow
  - Finance can add credit to wallet
  - Create WalletLedger entry (CREDIT)
  - Require approval for large amounts
  - **AC:** Wallet can be topped up

- [ ] **WAL-003:** Wallet settlement tracking
  - Track wallet balance vs actual reimbursements
  - Generate settlement report
  - **AC:** Settlement report available

- [ ] **WAL-004:** Wallet overdraft prevention
  - Prevent negative wallet balance
  - Alert when balance low
  - **AC:** Cannot create expense if wallet insufficient

### 2.3 Approval UI

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **APR-UI-001:** Build approval queue page
  - Show pending approvals for current user
  - Filter by type (Expense, Income)
  - Sort by date, amount
  - **AC:** User sees their pending approvals

- [ ] **APR-UI-002:** Add approval action buttons
  - Approve button
  - Reject button (with reason)
  - Partial approve (for large amounts)
  - **AC:** User can approve/reject

- [ ] **APR-UI-003:** Show approval history
  - Display all approvals for an expense
  - Show approver name, date, decision
  - **AC:** Full approval trail visible

- [ ] **APR-UI-004:** Add bulk approval
  - Select multiple pending items
  - Approve/reject in bulk
  - **AC:** Multiple items approved at once

---

## 🟡 **PHASE 3: DASHBOARD & REPORTING (Week 5-6)**

**Priority:** HIGH | **Duration:** 2 weeks | **Effort:** 50 hours

### Goal: Build comprehensive dashboard with real-time KPIs

### 3.1 Dashboard KPIs

**Status:** 🔲 TODO | **Priority:** 🟡 HIGH

#### Tasks:

- [ ] **DASH-001:** Implement financial summary
  - Total income (current month)
  - Total expenses (current month)
  - Net profit/loss
  - Comparison with previous month
  - **AC:** KPIs displayed on dashboard

- [ ] **DASH-002:** Add project metrics
  - Active projects count
  - Total contract value
  - Pending recovery amount
  - Project profitability
  - **AC:** Project KPIs shown

- [ ] **DASH-003:** Add wallet summary
  - Total wallet balance across all employees
  - Employees with low balance (<10K)
  - Pending settlements
  - **AC:** Wallet metrics displayed

- [ ] **DASH-004:** Add inventory alerts
  - Low stock items (below reorder level)
  - Out of stock items
  - Total inventory value
  - **AC:** Stock alerts visible

- [ ] **DASH-005:** Add pending approvals count
  - Count of pending approvals for current user
  - Count by type (Expense, Income)
  - Overdue approvals highlighted
  - **AC:** Approval counts shown

### 3.2 Dashboard Charts

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **DASH-CHART-001:** Install chart library
  - Options: Chart.js, Recharts, or ApexCharts
  - Install and configure
  - **AC:** Charts render correctly

- [ ] **DASH-CHART-002:** Income vs Expense trend (line chart)
  - Show last 12 months
  - Two lines: income, expense
  - **AC:** Trend visible

- [ ] **DASH-CHART-003:** Expense by category (pie chart)
  - Show current month breakdown
  - Top 5 categories
  - **AC:** Category distribution shown

- [ ] **DASH-CHART-004:** Project profitability (bar chart)
  - Show all active projects
  - Bar: profit/loss per project
  - **AC:** Project comparison visible

- [ ] **DASH-CHART-005:** Wallet balance trend (area chart)
  - Show wallet balance over time
  - Highlight low points
  - **AC:** Wallet trend shown

### 3.3 Reports Module

**Status:** 🔲 TODO | **Priority:** 🟡 HIGH

#### Tasks:

- [ ] **REP-001:** Financial reports
  - Profit & Loss statement
  - Income statement
  - Expense report by category
  - Date range filter
  - **AC:** Reports generated with correct data

- [ ] **REP-002:** Project reports
  - Project profitability report
  - Cost allocation by project
  - Budget vs actual
  - **AC:** Project reports available

- [ ] **REP-003:** Employee reports
  - Expense summary by employee
  - Wallet transaction history
  - Reimbursement report
  - **AC:** Employee reports generated

- [ ] **REP-004:** Inventory reports
  - Stock valuation report
  - Stock movement report
  - Low stock report
  - **AC:** Inventory reports available

- [ ] **REP-005:** Export to PDF
  - Install: `jsPDF` or similar
  - Generate PDF for all reports
  - Include charts and tables
  - **AC:** PDF exports work

- [ ] **REP-006:** Export to Excel
  - Install: `xlsx` (already installed)
  - Generate Excel for all reports
  - Multiple sheets for complex reports
  - **AC:** Excel exports work

---

## 🟢 **PHASE 4: UI/UX ENHANCEMENTS (Week 7-8)**

**Priority:** MEDIUM | **Duration:** 2 weeks | **Effort:** 50 hours

### Goal: Make UI professional, intuitive, and feature-rich

### 4.1 Global UI Improvements

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **UI-001:** Add component library
  - Options: shadcn/ui, HeadlessUI, or Radix
  - Install and configure
  - Create base components
  - **AC:** Consistent UI components

- [ ] **UI-002:** Implement responsive layout
  - Mobile-first design
  - Breakpoints: sm, md, lg, xl
  - Touch-friendly controls
  - **AC:** Works on mobile and desktop

- [ ] **UI-003:** Add loading states
  - Skeleton loaders for tables
  - Spinners for buttons
  - Progress bars for uploads
  - **AC:** Loading states visible

- [ ] **UI-004:** Add error states
  - Error messages for forms
  - Error boundaries for crashes
  - Toast notifications for errors
  - **AC:** Errors handled gracefully

- [ ] **UI-005:** Add empty states
  - Empty state illustrations
  - Clear call-to-action
  - **AC:** Empty states look professional

- [ ] **UI-006:** Implement dark mode
  - Toggle in settings
  - Persist user preference
  - **AC:** Dark mode works throughout app

### 4.2 Table Enhancements

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **TABLE-001:** Add pagination
  - Client-side or server-side pagination
  - Page size selector (10, 25, 50, 100)
  - **AC:** Large lists paginated

- [ ] **TABLE-002:** Add sorting
  - Sort by any column
  - Ascending/descending toggle
  - **AC:** Tables sortable

- [ ] **TABLE-003:** Add filtering
  - Global search
  - Column-specific filters
  - Date range pickers
  - **AC:** Data can be filtered

- [ ] **TABLE-004:** Add column visibility toggle
  - Show/hide columns
  - Save preference per user
  - **AC:** Columns toggleable

- [ ] **TABLE-005:** Add export buttons
  - Export to CSV
  - Export to Excel
  - Export to PDF
  - **AC:** Data exportable from tables

### 4.3 Form Enhancements

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **FORM-001:** Add form validation library
  - Install: React Hook Form + Zod
  - Implement on all forms
  - **AC:** Forms validated properly

- [ ] **FORM-002:** Add autocomplete/typeahead
  - For categories, projects, employees
  - Search as you type
  - **AC:** Autocomplete works

- [ ] **FORM-003:** Add date pickers
  - Install: react-datepicker or similar
  - Use for all date fields
  - **AC:** Date picking easy

- [ ] **FORM-004:** Add file upload with preview
  - Drag and drop
  - Image preview before upload
  - Progress indicator
  - **AC:** File upload smooth

- [ ] **FORM-005:** Add multi-step forms
  - For complex workflows (e.g., invoice creation)
  - Progress indicator
  - Save draft functionality
  - **AC:** Multi-step forms work

---

## 🟢 **PHASE 5: NOTIFICATIONS & INTEGRATIONS (Week 9-10)**

**Priority:** MEDIUM | **Duration:** 2 weeks | **Effort:** 40 hours

### Goal: Implement notification system and key integrations

### 5.1 Notification System

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **NOTIF-001:** Build notification service
  - File: `src/lib/notification-service.ts`
  - Create notification on events
  - Support types: INFO, WARNING, ERROR, SUCCESS
  - **AC:** Notifications created programmatically

- [ ] **NOTIF-002:** Implement in-app notifications
  - Show notification bell icon
  - Badge count for unread
  - Dropdown to view recent notifications
  - **AC:** Users see notifications in app

- [ ] **NOTIF-003:** Add notification preferences
  - User can enable/disable notification types
  - Store in User model
  - **AC:** Preferences respected

- [ ] **NOTIF-004:** Implement real-time notifications
  - Options: Server-Sent Events, WebSockets, or polling
  - Push notifications to browser
  - **AC:** Notifications appear without refresh

### 5.2 Email Notifications

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **EMAIL-001:** Integrate email service
  - Options: SendGrid, AWS SES, Resend
  - Configure API keys
  - Create email templates
  - **AC:** Emails can be sent

- [ ] **EMAIL-002:** Send approval notifications
  - Email when approval needed
  - Email when approved/rejected
  - Include action links
  - **AC:** Approvers receive emails

- [ ] **EMAIL-003:** Send daily digest
  - Summary of day's activities
  - Pending approvals
  - Schedule: 9 AM daily
  - **AC:** Daily digest sent

- [ ] **EMAIL-004:** Send overdue reminders
  - Invoice overdue alerts
  - Approval overdue alerts
  - Configurable: 7, 14, 30 days
  - **AC:** Reminders sent automatically

### 5.3 File Storage Integration

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **STORAGE-001:** Integrate AWS S3 or similar
  - Options: AWS S3, Cloudflare R2, DigitalOcean Spaces
  - Configure credentials
  - Create bucket/container
  - **AC:** Files stored in cloud

- [ ] **STORAGE-002:** Implement file upload API
  - Upload to S3 from API route
  - Generate signed URLs
  - Store metadata in database
  - **AC:** Files uploaded successfully

- [ ] **STORAGE-003:** Add file download
  - Generate temporary signed URLs
  - Download files from S3
  - Track downloads in audit log
  - **AC:** Files downloadable

- [ ] **STORAGE-004:** Add file preview
  - Preview images in browser
  - Preview PDFs inline
  - **AC:** Images and PDFs previewable

---

## 🟢 **PHASE 6: TESTING & QUALITY (Week 11-12)**

**Priority:** MEDIUM | **Duration:** 2 weeks | **Effort:** 40 hours

### Goal: Ensure system quality through comprehensive testing

### 6.1 Unit Tests

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **TEST-001:** Set up testing framework
  - Install: Vitest or Jest
  - Configure for Next.js
  - **AC:** Tests can run

- [ ] **TEST-002:** Test utility functions
  - `src/lib/format.ts`
  - `src/lib/validation.ts`
  - `src/lib/permissions.ts`
  - **AC:** 80%+ coverage on utils

- [ ] **TEST-003:** Test business logic
  - Approval engine
  - Wallet calculations
  - Inventory calculations
  - **AC:** Critical logic tested

### 6.2 Integration Tests

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **TEST-INT-001:** Test API endpoints
  - Test all CRUD operations
  - Test authentication required
  - Test permission checks
  - **AC:** All API routes tested

- [ ] **TEST-INT-002:** Test approval workflow
  - Submit expense → approve → wallet update
  - Test rejection flow
  - **AC:** Workflow tested end-to-end

- [ ] **TEST-INT-003:** Test database operations
  - Test transactions
  - Test referential integrity
  - **AC:** DB operations tested

### 6.3 E2E Tests

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **TEST-E2E-001:** Expand Playwright tests
  - Already started in `playwright/tests/auth.spec.ts`
  - Add more test cases
  - **AC:** Auth flows tested

- [ ] **TEST-E2E-002:** Test critical user flows
  - Login → Submit expense → Approve
  - Login → Create project → Add expense to project
  - Login → View dashboard
  - **AC:** Key flows work

- [ ] **TEST-E2E-003:** Test across browsers
  - Chrome, Firefox, Safari
  - Mobile browsers
  - **AC:** Works on all browsers

---

## 🟢 **PHASE 7: PERFORMANCE & OPTIMIZATION (Week 13-14)**

**Priority:** LOW | **Duration:** 2 weeks | **Effort:** 30 hours

### Goal: Optimize for speed and scalability

### 7.1 Performance Optimization

**Status:** 🔲 TODO | **Priority:** 🟢 LOW

#### Tasks:

- [ ] **PERF-001:** Implement caching
  - Cache dashboard KPIs (5 min TTL)
  - Cache user roles and permissions
  - Use Redis or in-memory cache
  - **AC:** Dashboard loads faster

- [ ] **PERF-002:** Optimize database queries
  - Add indexes on frequently queried columns
  - Use select() to limit fields
  - Implement pagination on large tables
  - **AC:** Queries under 100ms

- [ ] **PERF-003:** Optimize images
  - Use Next.js Image component
  - Serve WebP format
  - Lazy load images
  - **AC:** Images optimized

- [ ] **PERF-004:** Code splitting
  - Dynamic imports for heavy components
  - Route-based code splitting
  - **AC:** Initial bundle size reduced

- [ ] **PERF-005:** Add CDN for static assets
  - Configure Vercel CDN or Cloudflare
  - Serve static files from CDN
  - **AC:** Static assets load fast

### 7.2 Monitoring & Logging

**Status:** 🔲 TODO | **Priority:** 🟢 LOW

#### Tasks:

- [ ] **MON-001:** Integrate error tracking
  - Options: Sentry, LogRocket, Rollbar
  - Track client and server errors
  - **AC:** Errors logged automatically

- [ ] **MON-002:** Add performance monitoring
  - Options: Vercel Analytics, New Relic
  - Track page load times
  - Track API response times
  - **AC:** Performance metrics visible

- [ ] **MON-003:** Implement structured logging
  - Use Winston or Pino
  - Log all critical operations
  - Include context (user, action, timestamp)
  - **AC:** Logs searchable

---

## 🟢 **PHASE 8: DOCUMENTATION & DEPLOYMENT (Week 15-16)**

**Priority:** LOW | **Duration:** 2 weeks | **Effort:** 30 hours

### Goal: Complete documentation and prepare for production

### 8.1 Documentation

**Status:** 🔲 TODO | **Priority:** 🟢 LOW

#### Tasks:

- [ ] **DOC-001:** API documentation
  - Use Swagger/OpenAPI
  - Document all endpoints
  - Include request/response examples
  - **AC:** API docs accessible

- [ ] **DOC-002:** User manual
  - How to use each module
  - Screenshots and videos
  - Common workflows
  - **AC:** Users can self-serve

- [ ] **DOC-003:** Admin guide
  - User management
  - Role assignment
  - System configuration
  - Backup and restore
  - **AC:** Admins have complete guide

- [ ] **DOC-004:** Developer guide
  - Architecture overview
  - Setup instructions
  - Coding standards
  - How to add new features
  - **AC:** New devs can onboard

### 8.2 Deployment Preparation

**Status:** 🔲 TODO | **Priority:** 🟡 MEDIUM

#### Tasks:

- [ ] **DEPLOY-001:** Set up CI/CD pipeline
  - GitHub Actions or similar
  - Run tests on PR
  - Auto-deploy to staging
  - **AC:** Pipeline working

- [ ] **DEPLOY-002:** Configure production environment
  - Vercel or custom server
  - Production database
  - Environment variables
  - **AC:** Production env ready

- [ ] **DEPLOY-003:** Set up database backups
  - Daily automated backups
  - Backup to S3 or similar
  - Test restore process
  - **AC:** Backups working

- [ ] **DEPLOY-004:** Configure monitoring alerts
  - Error alerts
  - Performance degradation alerts
  - Database connection alerts
  - **AC:** Alerts configured

- [ ] **DEPLOY-005:** Create deployment checklist
  - Pre-deployment checks
  - Deployment steps
  - Post-deployment verification
  - Rollback procedure
  - **AC:** Checklist complete

---

## 📋 **FEATURE CHECKLIST BY MODULE**

### Authentication Module

- ✅ Email/password login
- ✅ Google OAuth (configured, needs credentials)
- ✅ User registration
- ✅ JWT sessions
- ✅ Role-based access control
- 🔲 Password reset flow
- 🔲 Email verification
- 🔲 Two-factor authentication (2FA)
- 🔲 Session management (view active sessions)
- 🔲 Account lockout after failed attempts

### Dashboard Module

- ✅ Basic page structure
- 🔲 Financial KPIs (income, expense, profit)
- 🔲 Wallet summary
- 🔲 Project metrics
- 🔲 Pending approvals count
- 🔲 Low stock alerts
- 🔲 Charts (income vs expense trend)
- 🔲 Recent activity feed
- 🔲 Date range filters
- 🔲 Comparison with previous period

### Expenses Module

- ✅ List all expenses
- ✅ Create expense
- ✅ Edit expense
- ✅ Delete expense
- ✅ Export to CSV
- ✅ Basic form validation
- 🔲 Advanced filters (date range, amount, category, project)
- 🔲 Search functionality
- 🔲 Pagination
- 🔲 Sorting
- 🔲 Expense details modal
- 🔲 Receipt upload and preview
- 🔲 Duplicate detection
- 🔲 Bulk operations
- 🔲 Expense approval workflow
- 🔲 Category autocomplete
- 🔲 Project dropdown

### Income Module

- ✅ List all income
- ✅ Create income
- ✅ Edit income
- ✅ Delete income
- ✅ Export to CSV
- 🔲 Advanced filters
- 🔲 Pagination
- 🔲 Sorting
- 🔲 Payment tracking
- 🔲 Invoice linking
- 🔲 Milestone tracking
- 🔲 Payment reminders
- 🔲 Approval workflow for large amounts

### Projects Module

- ✅ List all projects
- ✅ Create project
- ✅ Edit project
- ✅ Delete project
- ✅ Client and internal projects
- 🔲 Project dashboard (per project)
- 🔲 Expense allocation view
- 🔲 Profitability calculation
- 🔲 Aging report
- 🔲 Timeline/Gantt view
- 🔲 Document management per project
- 🔲 Team assignment
- 🔲 Budget tracking
- 🔲 Project status workflow
- 🔲 Project closing

### Employees Module

- ✅ List all employees
- ✅ Create employee
- ✅ Edit employee
- ✅ Delete employee
- ✅ Wallet balance display
- 🔲 Employee profile page
- 🔲 Wallet history details
- 🔲 Wallet top-up interface
- 🔲 Wallet settlement tracking
- 🔲 Performance metrics
- 🔲 Document storage per employee
- 🔲 Role change workflow
- 🔲 Employment status management

### Inventory Module

- ✅ List all items
- ✅ Create item
- ✅ Edit item
- ✅ Delete item
- ✅ Basic ledger API
- 🔲 Stock level indicators
- 🔲 Low stock warnings
- 🔲 Movement history per item
- 🔲 Valuation reports
- 🔲 Category management
- 🔲 Barcode/SKU search
- 🔲 Stock alerts
- 🔲 Reorder point management
- 🔲 FIFO/LIFO costing
- 🔲 Stock adjustment workflow

### Invoices Module

- ✅ List all invoices
- ✅ Create invoice
- ✅ Edit invoice
- ✅ Delete invoice
- 🔲 Invoice PDF generation
- 🔲 Email sending
- 🔲 Payment tracking
- 🔲 Overdue alerts
- 🔲 Recurring invoices
- 🔲 Invoice templates
- 🔲 Tax calculation
- 🔲 Multi-currency support

### Approvals Module

- ✅ Basic approval endpoint
- ✅ List pending approvals
- 🔲 Approval workflow engine
- 🔲 Threshold-based routing
- 🔲 Multi-level approvals
- 🔲 Approval SLA tracking
- 🔲 Bulk approve/reject
- 🔲 Approval delegation
- 🔲 Approval analytics
- 🔲 Email notifications
- 🔲 Approval history view

### Attachments Module

- ✅ Basic CRUD API
- ✅ List attachments
- 🔲 File upload with S3
- 🔲 File preview (images, PDFs)
- 🔲 File download
- 🔲 Version control
- 🔲 File size limits
- 🔲 File type restrictions
- 🔲 Access control per file
- 🔲 Virus scanning

### Notifications Module

- ✅ Basic CRUD API
- ✅ List notifications
- 🔲 Notification service
- 🔲 In-app notifications
- 🔲 Real-time notifications
- 🔲 Email notifications
- 🔲 Notification preferences
- 🔲 Daily digest
- 🔲 Reminder scheduling
- 🔲 Notification categories

### Audit Log Module

- ✅ Basic audit log model
- ✅ List audit logs
- 🔲 Automatic audit logging middleware
- 🔲 Log all mutations
- 🔲 Old/new value diff
- 🔲 Advanced filtering
- 🔲 Export to CSV
- 🔲 User action analytics
- 🔲 Compliance reporting

### Reports Module

- ✅ Basic page structure
- ✅ Export endpoint
- 🔲 Profit & Loss statement
- 🔲 Income statement
- 🔲 Expense by category
- 🔲 Project profitability
- 🔲 Employee expense summary
- 🔲 Inventory valuation
- 🔲 Approval turnaround time
- 🔲 PDF export
- 🔲 Excel export with charts
- 🔲 Custom date ranges

### Settings Module

- ✅ Role assignment
- 🔲 User profile management
- 🔲 Password change
- 🔲 Company settings
- 🔲 Email templates
- 🔲 Approval thresholds config
- 🔲 Notification preferences
- 🔲 Backup/restore
- 🔲 System logs
- 🔲 API keys management

---

## 🎯 **QUICK WIN TASKS (Can Start Immediately)**

These tasks can be done independently and deliver immediate value:

### Quick Wins - Week 1

1. **QW-001:** Replace NEXTAUTH_SECRET (15 min)
2. **QW-002:** Add Google OAuth credentials (30 min)
3. **QW-003:** Add loading spinners to all buttons (2 hrs)
4. **QW-004:** Add toast notifications for success/error (3 hrs)
5. **QW-005:** Implement dashboard financial KPIs (4 hrs)
6. **QW-006:** Add pagination to expenses list (3 hrs)
7. **QW-007:** Add search to expenses list (2 hrs)
8. **QW-008:** Add date range filter to expenses (3 hrs)

### Quick Wins - Week 2

9. **QW-009:** Implement automatic audit logging (6 hrs)
10. **QW-010:** Add expense approval UI (4 hrs)
11. **QW-011:** Add wallet auto-deduction on approval (4 hrs)
12. **QW-012:** Create PDF export for reports (6 hrs)
13. **QW-013:** Add low stock alerts to dashboard (3 hrs)
14. **QW-014:** Implement notification service (4 hrs)
15. **QW-015:** Add mobile responsive menu (4 hrs)
16. **QW-016:** Add form validation with Zod (6 hrs)

---

## 📊 **EFFORT ESTIMATION SUMMARY**

### By Phase

| Phase                        | Duration     | Effort      | Priority    |
| ---------------------------- | ------------ | ----------- | ----------- |
| Phase 1: Security & Fixes    | 1-2 weeks    | 40 hrs      | 🔴 Critical |
| Phase 2: Approval Workflow   | 2 weeks      | 60 hrs      | 🔴 High     |
| Phase 3: Dashboard & Reports | 2 weeks      | 50 hrs      | 🟡 High     |
| Phase 4: UI/UX Enhancements  | 2 weeks      | 50 hrs      | 🟡 Medium   |
| Phase 5: Notifications       | 2 weeks      | 40 hrs      | 🟡 Medium   |
| Phase 6: Testing             | 2 weeks      | 40 hrs      | 🟡 Medium   |
| Phase 7: Performance         | 2 weeks      | 30 hrs      | 🟢 Low      |
| Phase 8: Documentation       | 2 weeks      | 30 hrs      | 🟢 Low      |
| **TOTAL**                    | **16 weeks** | **340 hrs** |             |

### By Category

| Category       | Tasks   | Effort      | Priority    |
| -------------- | ------- | ----------- | ----------- |
| Security       | 15      | 30 hrs      | 🔴 Critical |
| Business Logic | 40      | 80 hrs      | 🔴 High     |
| UI/UX          | 50      | 100 hrs     | 🟡 Medium   |
| Testing        | 20      | 40 hrs      | 🟡 Medium   |
| Infrastructure | 25      | 50 hrs      | 🟡 Medium   |
| Documentation  | 15      | 40 hrs      | 🟢 Low      |
| **TOTAL**      | **165** | **340 hrs** |             |

---

## 🚀 **RECOMMENDED EXECUTION STRATEGY**

### For Single Developer (Full-Time)

- **Timeline:** 16 weeks (4 months)
- **Velocity:** ~20-25 hrs/week of focused development
- **Approach:** Sequential phases, complete Phase 1-3 first
- **Milestones:**
  - Month 1: Phases 1-2 complete (Security + Approvals)
  - Month 2: Phase 3 complete (Dashboard + Reports)
  - Month 3: Phases 4-5 complete (UI/UX + Notifications)
  - Month 4: Phases 6-8 complete (Testing + Deployment)

### For Team of 2 Developers

- **Timeline:** 10 weeks (2.5 months)
- **Velocity:** ~40 hrs/week combined
- **Approach:** Parallel work on different modules
- **Division:**
  - Developer 1: Backend (Approvals, Business Logic, APIs)
  - Developer 2: Frontend (UI/UX, Dashboard, Reports)

### For Rapid MVP (Minimum Viable Product)

- **Focus:** Phases 1-3 only
- **Timeline:** 6 weeks
- **Effort:** 150 hrs
- **Features:** Security + Approvals + Basic Reporting
- **Goal:** Get to production quickly with core workflows

---

## 📈 **SUCCESS METRICS & KPIs**

### Technical Metrics

- ✅ 0 critical bugs in production
- ✅ 90%+ test coverage on critical paths
- ✅ < 100ms average API response time
- ✅ < 2s page load time
- ✅ 99.9% uptime

### Business Metrics

- ✅ 100% of expenses require approval
- ✅ < 24 hrs average approval time
- ✅ 100% of transactions have audit trail
- ✅ Real-time wallet balance accuracy
- ✅ Daily automated backups

### User Experience Metrics

- ✅ < 5 clicks to submit expense
- ✅ < 3 clicks to approve expense
- ✅ Mobile-friendly (responsive)
- ✅ < 5 min onboarding time for new users
- ✅ Accessible (WCAG 2.1 Level AA)

---

## ⚠️ **RISKS & MITIGATION**

### Risk 1: Approval Workflow Complexity

- **Impact:** High
- **Probability:** Medium
- **Mitigation:** Start with simple threshold-based routing, add complexity incrementally

### Risk 2: Performance Issues with Large Datasets

- **Impact:** Medium
- **Probability:** Medium
- **Mitigation:** Implement pagination early, add database indexes

### Risk 3: Email Delivery Issues

- **Impact:** Medium
- **Probability:** Low
- **Mitigation:** Use reputable email service (SendGrid/SES), implement retry logic

### Risk 4: File Storage Costs

- **Impact:** Low
- **Probability:** Medium
- **Mitigation:** Implement file size limits, compress images, use lifecycle policies

### Risk 5: Security Vulnerabilities

- **Impact:** Critical
- **Probability:** Low
- **Mitigation:** Regular security audits, keep dependencies updated, input validation

---

## 🔧 **TECHNICAL DEBT TO ADDRESS**

### Current Technical Debt

1. **No comprehensive error handling** - Add try-catch blocks and error boundaries
2. **No input validation on all endpoints** - Add Zod schemas everywhere
3. **No database indexes** - Add indexes on frequently queried columns
4. **No caching** - Implement Redis or in-memory cache
5. **Basic UI components** - Need professional component library
6. **No API versioning** - Consider `/api/v1/` structure
7. **No rate limiting** - Add to prevent abuse
8. **Minimal testing** - Only 1 E2E test file exists

### Prioritized Fixes

1. 🔴 Add error handling and validation (Phase 1)
2. 🔴 Implement comprehensive testing (Phase 6)
3. 🟡 Add caching and indexes (Phase 7)
4. 🟡 Implement component library (Phase 4)
5. 🟢 API versioning (Future)

---

## 📚 **DEPENDENCIES & LIBRARIES TO ADD**

### Critical Dependencies (Phase 1-3)

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "react-hook-form": "^7.49.3",
    "zod": "^3.22.4", // Already installed
    "recharts": "^2.10.4", // For charts
    "date-fns": "^3.0.6", // Date manipulation
    "react-datepicker": "^4.25.0", // Date picker
    "react-hot-toast": "^2.4.1", // Toast notifications
    "@tanstack/react-table": "^8.11.3", // Advanced tables
    "jspdf": "^2.5.1", // PDF generation
    "jspdf-autotable": "^3.8.2", // PDF tables
    "xlsx": "^0.18.5", // Already installed
    "@aws-sdk/client-s3": "^3.490.0", // S3 uploads
    "@aws-sdk/s3-request-presigner": "^3.490.0"
  },
  "devDependencies": {
    "vitest": "^1.1.3", // Testing
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@playwright/test": "^1.40.1" // Already installed
  }
}
```

### Optional Dependencies (Phase 4-5)

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5", // Component library
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "class-variance-authority": "^0.7.0", // For component variants
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.303.0", // Icons
    "@sendgrid/mail": "^8.1.0", // Email service
    "ioredis": "^5.3.2" // Redis client for caching
  }
}
```

---

## 🎓 **LEARNING RESOURCES FOR CODEX**

### Next.js & React

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

### Database & ORM

- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)

### Authentication

- [NextAuth v5 Docs](https://authjs.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

### Testing

- [Vitest Guide](https://vitest.dev/guide/)
- [Playwright Testing](https://playwright.dev/)

### Charts & Visualization

- [Recharts Documentation](https://recharts.org/)

---

## 📝 **TASK TRACKING FORMAT**

Each task should be tracked with:

- **Task ID:** Unique identifier (e.g., SEC-001)
- **Title:** Brief description
- **Status:** 🔲 TODO, 🔄 IN PROGRESS, ✅ DONE, ❌ BLOCKED
- **Priority:** 🔴 Critical, 🟡 High, 🟢 Medium, 🔵 Low
- **Effort:** Hours estimate
- **Assignee:** Developer name
- **Dependencies:** Other tasks that must complete first
- **Acceptance Criteria:** How to verify completion

### Example Task Card

```
Task: SEC-001
Title: Replace NEXTAUTH_SECRET
Status: 🔲 TODO
Priority: 🔴 Critical
Effort: 0.25 hrs
Assignee: CODEX
Dependencies: None
Files: .env.local
Steps:
  1. Generate secret: openssl rand -base64 32
  2. Update .env.local
  3. Restart dev server
  4. Test login still works
Acceptance Criteria:
  ✅ NEXTAUTH_SECRET is 32+ bytes
  ✅ Login works
  ✅ Session persists
```

---

## 🎯 **NEXT IMMEDIATE ACTIONS FOR CODEX**

### Start Here (Priority Order):

1. **SEC-001:** Replace NEXTAUTH_SECRET (15 min)
2. **SEC-002:** Add Google OAuth credentials (30 min)
3. **VAL-001:** Add Zod validation to expense API (2 hrs)
4. **DASH-001:** Implement financial KPIs on dashboard (4 hrs)
5. **APR-001:** Build approval workflow engine (8 hrs)
6. **UI-001:** Install and configure component library (3 hrs)
7. **TEST-001:** Set up Vitest testing framework (2 hrs)

### Daily Development Routine:

1. Pick highest priority task from current phase
2. Create feature branch
3. Implement with tests
4. Update audit logging if mutation
5. Test locally
6. Create PR with description
7. Mark task as ✅ DONE

---

## ✅ **DEFINITION OF DONE**

A feature is considered DONE when:

- ✅ Code is written and follows TypeScript standards
- ✅ All acceptance criteria met
- ✅ Unit tests written (for business logic)
- ✅ Integration test written (for APIs)
- ✅ E2E test written (for critical flows)
- ✅ Error handling implemented
- ✅ Audit logging added (for mutations)
- ✅ Permission checks in place
- ✅ Validation implemented
- ✅ UI is responsive (mobile + desktop)
- ✅ Loading and error states handled
- ✅ Documentation updated (if needed)
- ✅ Tested on dev environment
- ✅ Code reviewed (if team)
- ✅ No ESLint errors
- ✅ Build passes

---

## 🎊 **CONCLUSION**

This execution plan transforms AutoMatrix ERP from a **functional prototype (35% complete)** to a **professional mini ERP (100% complete)** in **16 weeks** with **340 hours** of focused development.

**Key Success Factors:**

1. ✅ Start with security fixes (Phase 1)
2. ✅ Build approval workflow early (Phase 2)
3. ✅ Make dashboard useful (Phase 3)
4. ✅ Polish UI incrementally (Phase 4-5)
5. ✅ Test continuously (Phase 6)
6. ✅ Optimize before launch (Phase 7)
7. ✅ Document everything (Phase 8)

**Remember:**

- 🎯 Quality over speed - Do it right the first time
- 🧪 Test early and often
- 📝 Document as you go
- 🔒 Security is not optional
- 👥 Think about the end user
- 📊 Measure what matters

**Good luck, CODEX! You've got this! 🚀**

---

_Last updated: January 29, 2026_  
_Plan version: 2.0_  
_Status: Ready for execution_

---

## 📝 UPDATE LOG

### January 29, 2026 - Currency Update

- **Changed:** Currency format from ₹ (INR) to PKR
- **File:** `src/lib/format.ts`
- **Impact:** All money displays throughout application
- **Reason:** AutoMatrix ERP is for Pakistani market
