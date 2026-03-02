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
