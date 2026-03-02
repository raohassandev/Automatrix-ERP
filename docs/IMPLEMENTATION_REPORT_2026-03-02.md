# Implementation Report — 2026-03-02 (Codex)

## Scope completed in this pass
- Finance guardrails and guided form UX for invoice-linked income receipts.
- Color and readability upgrade across owner-critical modules: Finance, Inventory, Projects, Employees, Payroll, Procurement AP.
- Module status snapshot refresh in `SUPER_MASTER_PLAN.md` (still in-progress, but with newly completed sub-capabilities logged).
- Added HRMS attendance + leave workflows (with access scoping and approval actions).
- Added Bank Reconciliation workflow (book vs statement comparison + saved snapshots).

## Functional changes
- Enforced receipt allocation safety in finance flow (no over-allocation against invoice outstanding):
  - `src/lib/invoice-allocation.ts`
  - `src/app/api/income/route.ts`
  - `src/app/api/income/[id]/route.ts`
  - `src/lib/approval-engine.ts`
  - `src/app/api/invoices/outstanding/route.ts`
- Improved income form behavior for non-accounting users:
  - invoice outstanding dropdown
  - auto-project fill from selected invoice
  - clearer validation and helper messaging
  - `src/components/IncomeFormDialog.tsx`
  - `src/components/IncomeForm.tsx`

## HRMS and Treasury completion increment
- Added new additive data models:
  - `AttendanceEntry`
  - `LeaveRequest`
  - `BankReconciliationSnapshot`
  - Schema/migration:
    - `prisma/schema.prisma`
    - `prisma/migrations/20260302064000_add_hrms_attendance_leave_and_bank_reconciliation/migration.sql`
- HRMS backend:
  - `src/lib/hrms-access.ts`
  - `src/app/api/hrms/attendance/route.ts`
  - `src/app/api/hrms/attendance/[id]/route.ts`
  - `src/app/api/hrms/leave/route.ts`
  - `src/app/api/hrms/leave/[id]/route.ts`
- HRMS UI:
  - `src/app/hrms/attendance/page.tsx`
  - `src/app/hrms/leave/page.tsx`
  - `src/components/hrms/AttendanceManager.tsx`
  - `src/components/hrms/LeaveManager.tsx`
- Treasury / Bank Reconciliation backend:
  - `src/lib/bank-reconciliation.ts`
  - `src/app/api/reports/accounting/bank-reconciliation/route.ts`
- Treasury / Bank Reconciliation UI:
  - `src/app/reports/accounting/bank-reconciliation/page.tsx`
  - `src/components/BankReconciliationManager.tsx`

## UI/UX upgrades (color + clarity)
- Added semantic status badge component and integrated it into key tables:
  - `src/components/StatusBadge.tsx`
  - `src/app/invoices/page.tsx`
  - `src/app/income/page.tsx`
  - `src/app/payroll/page.tsx`
  - `src/components/ProjectsTable.tsx`
  - `src/components/EmployeesTable.tsx`
  - `src/app/procurement/vendor-bills/page.tsx`
  - `src/app/procurement/vendor-payments/page.tsx`
  - `src/app/company-accounts/page.tsx`
- Added visual summary cards for faster operational scanning:
  - `src/app/invoices/page.tsx`
  - `src/app/income/page.tsx`
  - `src/app/inventory/page.tsx`
  - `src/app/projects/page.tsx`
  - `src/app/employees/page.tsx`
  - `src/app/payroll/page.tsx`
  - `src/app/procurement/vendor-bills/page.tsx`
  - `src/app/procurement/vendor-payments/page.tsx`
  - `src/app/company-accounts/page.tsx`
  - `src/app/reports/accounting/cash-position/page.tsx`
- Inventory stock health made explicit in list UI (Healthy/Reorder/Low):
  - `src/components/InventoryTable.tsx`
- Updated global light theme and page atmosphere for a softer, more descriptive color system:
  - `src/app/globals.css`

## Plan updates
- Updated owner-critical module notes under:
  - `SUPER_MASTER_PLAN.md` -> `## 11.2 Owner-Critical Module Status (Requested)`
- Updated navigation/report access surfaces:
  - `src/lib/navigation.ts`
  - `src/components/CommandPalette.tsx`
  - `src/app/reports/page.tsx`

## Verification
- Run after this change-set:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

## Treasury completion pass (Module 15)
- Added bank statement ingestion and reconciliation operations:
  - New model:
    - `BankStatementLine`
  - New migration:
    - `prisma/migrations/20260302070000_add_bank_statement_lines/migration.sql`
- Added statement import parser and import endpoint:
  - `src/lib/bank-statement-import.ts`
  - `src/app/api/reports/accounting/bank-reconciliation/import/route.ts`
- Added auto-match and manual exception actions:
  - `src/lib/bank-reconciliation.ts` (`autoMatchStatementLines`)
  - `src/app/api/reports/accounting/bank-reconciliation/auto-match/route.ts`
  - `src/app/api/reports/accounting/bank-reconciliation/line/[id]/route.ts`
- Added reconciliation close endpoint with unmatched-line guard and force-close option:
  - `src/app/api/reports/accounting/bank-reconciliation/close/route.ts`
- Expanded reconciliation API/page/UI with exception queue and actions:
  - `src/app/api/reports/accounting/bank-reconciliation/route.ts`
  - `src/app/reports/accounting/bank-reconciliation/page.tsx`
  - `src/components/BankReconciliationManager.tsx`
- Updated master plan status:
  - `SUPER_MASTER_PLAN.md` marks module `15` (Treasury & Banking) as completed `[x]`.

## Employee module completion pass (Modules 11, 12, 13)
- Added payroll policy engine and auto-fill generation:
  - `src/lib/payroll-policy.ts`
  - `src/app/api/payroll/runs/policy-preview/route.ts`
  - integrated in payroll run dialog:
    - `src/components/PayrollRunFormDialog.tsx`
- Added payroll approval auto-settlement of approved salary advances (based on payroll deductions):
  - `src/app/api/payroll/runs/[id]/route.ts`
- Expanded self-service depth in My Portal:
  - attendance monthly summary cards
  - leave request summary table
  - direct links to attendance/leave HRMS workflows
  - `src/app/me/page.tsx`
- Updated locked module status:
  - `SUPER_MASTER_PLAN.md` marks modules `11`, `12`, and `13` as completed `[x]` for locked baseline.

## Finance core completion pass (Module 14)
- Added open-period posting guards on source flows so invoice/income entries cannot post with a date in closed fiscal periods:
  - `src/lib/accounting.ts`
  - `src/app/api/invoices/route.ts`
  - `src/app/api/invoices/[id]/route.ts`
  - `src/app/api/income/route.ts`
  - `src/app/api/income/[id]/route.ts`
- Added O2C reconciliation report with exception surfaces for release-grade close readiness:
  - API: `src/app/api/reports/accounting/o2c-reconciliation/route.ts`
  - Page: `src/app/reports/accounting/o2c-reconciliation/page.tsx`
  - Data engine: `src/lib/accounting-reports.ts` (`getO2cReconciliation`)
- Added fiscal period close checklist and close guardrails:
  - Checklist API: `src/app/api/accounting/period-close/checklist/route.ts`
  - Close API: `src/app/api/accounting/period-close/close/route.ts`
  - Enforced in existing close action: `src/app/api/accounting/fiscal-periods/[id]/route.ts`
  - UI close feedback now includes checklist blocking reasons:
    - `src/components/FiscalPeriodsManager.tsx`
- Updated reporting/navigation entry points:
  - `src/app/reports/page.tsx`
  - `src/lib/navigation.ts`
- Updated module lock status:
  - `SUPER_MASTER_PLAN.md` marks module `14` (Finance and Accounting Core) as completed `[x]` for locked baseline.

## Incomplete-modules execution pass (owner-directed)

### Employee wallet history completion
- Added full drilldown-friendly wallet history improvements:
  - Wallet ledger now supports `employeeId` + `sourceType` filtering for targeted traceability.
  - Wallet list/export now include posting trace fields (`sourceType`, `companyAccount`, `postedBy`).
  - Added direct “Full History” links from employee profile and My Dashboard wallet widgets.
- Files:
  - `src/app/wallets/page.tsx`
  - `src/app/api/wallets/export/route.ts`
  - `src/app/employees/[id]/page.tsx`
  - `src/app/me/page.tsx`

### Approvals engine completion increment
- Expanded recent approval history to include both `Expense` and `Income` decisions in a unified timeline.
- Added approval-history type badges for faster review context.
- Files:
  - `src/app/approvals/page.tsx`
  - `src/components/ApprovalQueue.tsx`

### Procurement (P2P) completion increment
- Added document-level attachments support for core procurement docs:
  - Purchase Orders
  - Goods Receipts (GRN)
  - Vendor Bills
- Added reusable procurement attachment dialog with inline listing + URL add flow and audit-backed APIs.
- Surfaced notes in PO/GRN/Vendor Bill list tables for operational readability.
- Files:
  - `src/app/api/procurement/purchase-orders/[id]/attachments/route.ts`
  - `src/app/api/procurement/grn/[id]/attachments/route.ts`
  - `src/app/api/procurement/vendor-bills/[id]/attachments/route.ts`
  - `src/components/ProcurementAttachmentsDialog.tsx`
  - `src/components/PurchaseOrderActions.tsx`
  - `src/components/GoodsReceiptActions.tsx`
  - `src/components/VendorBillActions.tsx`
  - `src/app/procurement/purchase-orders/page.tsx`
  - `src/app/procurement/grn/page.tsx`
  - `src/app/procurement/vendor-bills/page.tsx`

### Expense management completion increment
- Improved expense operational controls for finance users:
  - Added direct `Mark Paid` action from expense list (permission-aware, uses existing API posting flow).
  - Updated status filters to real workflow states (`PENDING_L1`, `PENDING_L2`, `PENDING_L3`, `APPROVED`, `REJECTED`, `PAID`).
  - Added at-a-glance amount cards (total/pending/approved/paid) on expense page.
- Files:
  - `src/components/ExpenseActions.tsx`
  - `src/app/expenses/page.tsx`

### Inventory and store completion increment
- Added warehouse-level traceability in inventory ledger:
  - warehouse filter in ledger page
  - warehouse column in table/mobile
  - warehouse included in CSV export
- Reinforced procurement-first stock-in UX in manual movement dialog by removing purchase stock-in option from manual UI.
- Files:
  - `src/app/inventory/ledger/page.tsx`
  - `src/app/inventory/ledger/LedgerClient.tsx`
  - `src/app/api/inventory/ledger/export/route.ts`
  - `src/components/InventoryLedgerActions.tsx`
  - `src/components/InventoryLedgerDialog.tsx`

### Validation
- Completed after each change-set:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

## Broad incomplete-module hardening pass

### Inventory + Master Data controls
- Added warehouse master APIs and management UI:
  - `GET/POST /api/warehouses`
  - `PATCH /api/warehouses/[id]`
  - UI: `src/app/inventory/warehouses/page.tsx` + `src/components/WarehousesManager.tsx`
- Added warehouse-aware manual inventory movements:
  - `warehouseId` accepted in inventory ledger payload and validated as active
  - manual movement dialog now lets user choose warehouse
  - files:
    - `src/lib/validation.ts`
    - `src/app/api/inventory/ledger/route.ts`
    - `src/components/InventoryLedgerDialog.tsx`

### Audit, Compliance, Reporting depth
- Upgraded audit page permissions/filters:
  - now enforced by `audit.view`
  - supports filtering by action/entity/date range with CSV export
  - file: `src/app/audit/page.tsx`
- Added audit CSV export endpoint:
  - `src/app/api/audit/export/route.ts`
- Added dedicated exceptions report for blocked-policy events (`BLOCK_*` audit actions):
  - page: `src/app/reports/exceptions/page.tsx`
  - linked into report surfaces:
    - `src/app/reports/page.tsx`
    - `src/lib/navigation.ts`

## Approvals engine completion increment (procurement coverage)
- Extended central approvals screen to include pending procurement approvals:
  - added unified queue for `SUBMITTED` Vendor Bills and Vendor Payments with amount, level, vendor, project/account context.
  - approvers can now approve/reject these documents directly from Approvals page.
- Added policy-based eligibility filtering for procurement approvals:
  - uses existing approval policy engine (`module: procurement`) and amount thresholds.
- Integrated procurement queue into approvals KPIs:
  - total pending, total amount, and L1/L2/L3 counters now include procurement documents.
- Files:
  - `src/components/ProcurementApprovalQueue.tsx`
  - `src/app/approvals/page.tsx`

## Procurement + Inventory completion hardening pass
- Added Vendor Payment attachment support to complete procurement document parity:
  - API endpoint: `GET/POST /api/procurement/vendor-payments/[id]/attachments`
  - UI action integrated in Vendor Payments list actions via existing attachment dialog.
  - Audit action added: `VENDOR_PAYMENT_ATTACHMENT_ADD`.
- Improved Vendor Payments operational table readability:
  - added Notes column to list view.
  - action refresh now updates page state immediately after lifecycle transitions.
- Enforced single-spine inventory rule server-side:
  - manual inventory ledger route now blocks `PURCHASE` type stock-in and logs `BLOCK_MANUAL_PURCHASE_STOCK_IN`.
  - stock-in is now enforced as procurement-only (`PO -> GRN -> POST`) at API layer, not only in UI.
- Files:
  - `src/app/api/procurement/vendor-payments/[id]/attachments/route.ts`
  - `src/components/VendorPaymentActions.tsx`
  - `src/app/procurement/vendor-payments/page.tsx`
  - `src/app/api/inventory/ledger/route.ts`

## Project management commercial-control completion increment
- Extended project detail financial contract with owner-level commercial fields:
  - contract/invoiced/received/cost-to-date/pending-recovery/gross-margin/margin%.
- Added explicit project cash-risk signals in project detail policy:
  - overdue recovery amount + overdue invoice count
  - negative margin flag
  - high unpaid vendor exposure flag
  - plain-language alert list for non-accounting operators.
- Upgraded Project Detail `Costs` tab UX:
  - added commercial summary cards and risk panel.
  - added direct drilldown links to project-matched Vendor Bills, Vendor Payments, Expenses, Income.
  - retained source-linked financial transaction table.
- Upgraded Project Financial dashboard (`/projects/financial`):
  - added overdue recovery and cash-risk project counts to top cards.
  - added per-project risk chips (negative margin / overdue recovery / vendor exposure high).
  - added quick action links for expenses, income, vendor bills, and full project detail.
- Upgraded Project finance CSV export:
  - includes commercial-control fields + overdue recovery metrics before transactional section.
- Files:
  - `src/lib/project-detail-policy.ts`
  - `src/app/projects/[id]/ProjectDetailClient.tsx`
  - `src/app/projects/financial/page.tsx`
  - `src/app/reports/projects/page.tsx`
  - `src/app/api/reports/projects/[id]/export/route.ts`

## Procurement + Inventory + Project completion pass (locked baseline closure)
- Procurement (P2P) hardening:
  - added strict GRN-linked vendor bill quantity cap validation.
  - billing quantity now cannot exceed received GRN quantity across non-void vendor bills.
  - validation enforced on both bill create and bill update routes.

- Inventory and Store hardening:
  - added warehouse-to-warehouse transfer operation with double ledger entries and shared transfer trace ID.
  - added transfer API endpoint: `POST /api/inventory/transfer`.
  - added transfer dialog in Inventory Ledger actions for operator-friendly stock movement.
  - transfer flow is audited via `INVENTORY_TRANSFER`.

- Project Management execution closure:
  - added `ProjectTask` execution model (status/priority/progress/due date/assignee).
  - added project task APIs:
    - `GET/POST /api/projects/[id]/tasks`
    - `PATCH /api/projects/[id]/tasks/[taskId]`
  - extended project detail policy and UI with dedicated `Execution` tab:
    - task summary cards
    - task creation
    - inline status/progress/due-date updates
    - assignee-aware task visibility context.

- Plan synchronization:
  - updated `SUPER_MASTER_PLAN.md` section `11.1` to mark modules `6`, `7`, and `8` as `[x]` completed for locked baseline.

- Files:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260302143000_add_project_execution_tasks/migration.sql`
  - `src/app/api/projects/[id]/tasks/route.ts`
  - `src/app/api/projects/[id]/tasks/[taskId]/route.ts`
  - `src/app/api/procurement/vendor-bills/route.ts`
  - `src/app/api/procurement/vendor-bills/[id]/route.ts`
  - `src/app/api/inventory/transfer/route.ts`
  - `src/components/InventoryTransferDialog.tsx`
  - `src/components/InventoryLedgerActions.tsx`
  - `src/app/inventory/ledger/LedgerClient.tsx`
  - `src/lib/project-detail-policy.ts`
  - `src/app/projects/[id]/ProjectDetailClient.tsx`
  - `SUPER_MASTER_PLAN.md`

## Organization + Master Data + Expense management focus pass
- Organization and Settings:
  - Added persistent organization defaults model (`OrganizationSetting`) and migration.
  - Added settings API: `GET/PATCH /api/settings/organization`.
  - Added `OrganizationSettingsManager` UI to manage:
    - company profile, currency, timezone
    - fiscal-year start month
    - default customer/vendor terms days
    - expense receipt threshold
  - Updated settings page to include organization defaults section and quick links to master data/expenses.

- Master Data Management:
  - Added centralized Master Data Center page: `/master-data`.
  - Added quality/volume counters and direct links to Clients, Vendors, Categories, Departments, Designations, and Item Master.
  - Added sidebar navigation entry for `Master Data`.

- Expense Management:
  - Added bulk paid operation API:
    - `PUT /api/expenses/bulk-mark-paid` (permission: `expenses.mark_paid`)
    - returns marked and skipped result sets.
  - Added expense page bulk-selection + bulk mark-paid workflow for approved expenses.
  - Added explicit non-stock policy banner on expense page for operator clarity.

- Files:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260302150000_add_organization_settings/migration.sql`
  - `src/app/api/settings/organization/route.ts`
  - `src/components/OrganizationSettingsManager.tsx`
  - `src/app/settings/page.tsx`
  - `src/app/master-data/page.tsx`
  - `src/lib/navigation.ts`
  - `src/app/api/expenses/bulk-mark-paid/route.ts`
  - `src/app/expenses/page.tsx`

## Completion pass: Modules 1,2,3,10,16,17,18

### Identity, RBAC, and Security
- Added auth lifecycle audit events for traceability:
  - successful/denied sign-ins are now audited (`AUTH_SIGNIN_SUCCESS`, `AUTH_SIGNIN_DENIED`)
  - sign-out is now audited (`AUTH_SIGNOUT`)
- File:
  - `src/lib/auth.ts`

### Organization and Settings
- Added reusable organization defaults resolver for runtime policy usage:
  - `src/lib/organization-settings.ts`
- Organization settings API now allows authenticated read access for default-driven forms while keeping writes permission-gated.
- File:
  - `src/app/api/settings/organization/route.ts`

### Master Data Management
- Expanded Master Data Center with quality metrics panel (vendor contact completeness + category/HR dimensions).
- File:
  - `src/app/master-data/page.tsx`

### Expense Management
- Enforced organization-level receipt policy server-side on create/update:
  - blocks expense submission/update when amount exceeds configured threshold and receipt is missing
  - emits control audit action `BLOCK_EXPENSE_MISSING_RECEIPT`
- Added client-side receipt-threshold guidance and validation in expense form for easier operator behavior.
- Added `expenses.mark_paid` permission mapping in RBAC/seed role maps for finance workflows.
- Files:
  - `src/app/api/expenses/route.ts`
  - `src/app/api/expenses/[id]/route.ts`
  - `src/components/ExpenseForm.tsx`
  - `src/lib/permissions.ts`
  - `prisma/seed.js`

### Approvals Engine
- Hardened approval stats computation:
  - includes real pending statuses (`PENDING_*`) and both Expense + Income streams
  - removed invalid `approvedAt` dependency and computes avg approval cycle from `createdAt` -> `updatedAt`
  - added overdue counters by SLA window and module
- Added overdue count visibility on approvals page.
- Files:
  - `src/lib/approval-engine.ts`
  - `src/app/approvals/page.tsx`

### Audit, Compliance, and Governance
- Upgraded `GET /api/audit` with enterprise filters + pagination:
  - search/action/entity/date filters
  - page + limit + total/totalPages metadata
- File:
  - `src/app/api/audit/route.ts`

### Reporting and BI
- Added controls KPI report page for operational governance signals:
  - queue load (expense/income/procurement submitted)
  - blocked events (30d)
  - auth denied/success trends (30d)
- Linked into reports home for discoverability.
- Files:
  - `src/app/reports/controls/page.tsx`
  - `src/app/reports/page.tsx`

### Plan status update
- Updated `SUPER_MASTER_PLAN.md` section `11.1 Status Snapshot`:
  - marked modules `1`, `2`, `3`, `10`, `16`, `17`, `18` as `[x]`
  - remaining non-complete modules are now focused on `19` and `20`.

### Validation
- `pnpm typecheck` passed
- `pnpm lint` passed
- `pnpm test` passed

## Owner-critical program pass: incentives, commissions, payroll settlement (Phase A/B)

### Data and schema
- Added payout/settlement tracking on incentives:
  - `formulaType`, `basisAmount`, `percent`, `payoutMode`
  - `settlementStatus`, `settledInPayrollRunId`, `settledInPayrollEntryId`, `settledAt`
- Added commission support for employee or middleman:
  - `payeeType`, optional `employeeId`, optional `vendorId`
  - `payoutMode` (`PAYROLL`/`WALLET`/`AP`) and settlement linkage fields
- Added payroll component breakdown model:
  - `PayrollComponentLine` linked to `PayrollEntry` for salary slip line-item visibility.
- Files:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260302191000_owner_critical_variable_pay_and_payroll_components/migration.sql`

### Posting and API behavior
- Incentives:
  - supports fixed amount and formula paths (`PERCENT_PROFIT`, `PERCENT_AMOUNT`)
  - approval creates project expense and either payroll settlement (default) or wallet credit
  - settled entries are protected from deletion.
- Commissions:
  - supports employee commission and middleman commission in one flow
  - middleman approval creates posted vendor bill + posted journal (`MIDDLEMAN_COMMISSION`)
  - employee commission supports payroll settlement or wallet payout
  - settled entries are protected from deletion.
- Payroll:
  - approval now settles approved payroll-mode incentives and employee commissions into the payroll entry
  - stores salary slip line items in `PayrollComponentLine`
  - prevents approval if payroll incentive total is below approved variable pay linkage.
- Files:
  - `src/app/api/incentives/route.ts`
  - `src/app/api/incentives/[id]/route.ts`
  - `src/app/api/commissions/route.ts`
  - `src/app/api/commissions/[id]/route.ts`
  - `src/app/api/payroll/runs/route.ts`
  - `src/app/api/payroll/runs/[id]/route.ts`
  - `src/lib/payroll-policy.ts`

### UX and self-service updates
- Guided incentive and commission forms for non-accounting users:
  - formula selection, payout mode, employee vs middleman payee flow.
- Commissions/incentives list pages now expose payout and settlement context.
- My Dashboard expanded for employee self-service:
  - pending payroll incentives
  - company advance issued/outstanding
  - salary and component visibility.
- Payroll export now includes component line breakdown.
- Wallet issue flow now captures purpose and maps to explicit source types for history traceability.
- Files:
  - `src/components/IncentiveFormDialog.tsx`
  - `src/components/CommissionFormDialog.tsx`
  - `src/app/incentives/page.tsx`
  - `src/app/commissions/page.tsx`
  - `src/app/me/page.tsx`
  - `src/app/api/me/payroll/export/route.ts`
  - `src/app/api/me/incentives/export/route.ts`
  - `src/components/EmployeeWalletDialog.tsx`
  - `src/app/api/employees/wallet/route.ts`
  - `src/app/wallets/page.tsx`
  - `src/lib/approval-engine.ts`
  - `src/app/api/salary-advances/[id]/route.ts`

### Plan status update
- Updated `SUPER_MASTER_PLAN.md` section `17`:
  - Phase A marked `[x] Completed`
  - Phase B marked `[x] Completed`
  - Phase C marked `[~] In Progress`
  - Progress tracker and evidence references updated.

### Validation run in this pass
- `pnpm prisma generate` passed
- `pnpm typecheck` passed
- `pnpm lint` passed
- `pnpm test` passed (33 tests)
- Targeted staging e2e passed:
  - `pnpm playwright test --config=playwright.config.staging.ts playwright/tests/item-detail-and-me-portal.spec.ts playwright/tests/project-financial-overview.spec.ts playwright/tests/project-ae-pv-regression.spec.ts`
  - Result: `8 passed`

## Mobile responsiveness hardening pass (owner-critical modules)

### Scope
- Improved mobile UX/layout for owner-critical pages:
  - `My Dashboard` (`/me`)
  - `Project Detail` tabs (`activity/costs/inventory/people/execution/documents`)
  - `Incentives`, `Commissions`, `Payroll` listing pages
- Added mobile-friendly action layout in incentive/commission dialogs.

### Implementation highlights
- Added card-based mobile rendering (`md:hidden`) alongside desktop tables (`hidden md:block`) to avoid horizontal scroll dependency.
- Converted dense financial/operational tables to readable mobile cards with key fields and actions.
- Ensured form action buttons stack correctly on small screens.

### Files
- `src/app/me/page.tsx`
- `src/app/projects/[id]/ProjectDetailClient.tsx`
- `src/app/incentives/page.tsx`
- `src/app/commissions/page.tsx`
- `src/app/payroll/page.tsx`
- `src/components/IncentiveFormDialog.tsx`
- `src/components/CommissionFormDialog.tsx`
- `playwright/tests/mobile-owner-critical-layout.spec.ts`

### Validation
- Local:
  - `pnpm typecheck` passed
  - `pnpm lint` passed
  - `pnpm test` passed
  - `pnpm build` passed
- Staging Playwright:
  - `pnpm playwright test --config=playwright.config.staging.ts playwright/tests/mobile-owner-critical-layout.spec.ts playwright/tests/item-detail-and-me-portal.spec.ts playwright/tests/project-detail-rbac.spec.ts playwright/tests/project-financial-overview.spec.ts`
  - Result: `15 passed`

## Procurement + Inventory control hardening pass

### Scope
- Enforced warehouse-level stock controls to prevent cross-warehouse negative moves.
- Tightened GRN eligibility rules against non-receivable PO states.
- Added potential duplicate vendor-bill protection to reduce accidental duplicate AP entries.

### Backend controls added
- Inventory ledger manual posting:
  - blocked manual `TRANSFER` entries (must use dedicated transfer flow).
  - outflow now checks warehouse-level quantity before posting.
  - running balance now records warehouse-level running quantity.
- Inventory transfer:
  - checks source warehouse stock (not only global item stock).
  - updates running balances using source/destination warehouse quantities.
- GRN create/edit/submit:
  - linked PO must be in `ORDERED | RECEIVED | PARTIALLY_RECEIVED`.
  - blocks GRN operations when PO is not receivable.
- Vendor bill create/update:
  - detects potential duplicates by `vendor + project + billDate(day) + total`.
  - returns `409` with duplicate reference unless `ignoreDuplicate=true`.
  - logs control audit action: `BLOCK_POTENTIAL_DUPLICATE_VENDOR_BILL`.

### Files
- `src/lib/inventory-balance.ts` (new)
- `src/app/api/inventory/ledger/route.ts`
- `src/app/api/inventory/transfer/route.ts`
- `src/app/api/procurement/grn/route.ts`
- `src/app/api/procurement/grn/[id]/route.ts`
- `src/app/api/procurement/vendor-bills/route.ts`
- `src/app/api/procurement/vendor-bills/[id]/route.ts`
- `playwright/tests/procurement-inventory-controls.spec.ts` (new)

### Validation
- Local:
  - `pnpm typecheck` passed
  - `pnpm lint` passed
  - `pnpm test` passed
  - `pnpm build` passed
- Staging regression check:
  - `pnpm playwright test --config=playwright.config.staging.ts playwright/tests/rb4-procurement-chain.spec.ts`
  - Result: `2 passed`
