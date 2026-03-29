# Role-Objective Recovery Playwright Audit

- Generated: 2026-03-29T09:10:41.278Z
- Base URL: https://erp-staging.automatrix.pk
- Accounts audited: israrulhaq5@gmail.com, raoabdulkhaliq786@gmail.com, raomazeem1122@gmail.com, raoibrarulhaq1@gmail.com, raomubasher5555@gmail.com
- Shared password used: Yes

## Summary

- israrulhaq5@gmail.com: role=Owner, passed=3, failed=0
- raoabdulkhaliq786@gmail.com: role=Accountant, passed=3, failed=0
- raomazeem1122@gmail.com: role=Guest, passed=1, failed=2
- raoibrarulhaq1@gmail.com: role=Guest, passed=1, failed=2
- raomubasher5555@gmail.com: role=Guest, passed=1, failed=2

## Details

## israrulhaq5@gmail.com

- Detected role: Owner
- Objective pass count: 3
- Objective fail count: 0
- Objectives passed: Self-service portal works, Employee finance workspace works, Employee expense report works
- Objectives failed: None
- Effective permissions sample: *, accounting.manage, accounting.view, approvals.approve_high, approvals.approve_low, approvals.partial_approve, approvals.view_all, approvals.view_pending, attachments.edit, attachments.view_all, audit.view, categories.manage

| Objective | Route | Outcome | Direct Nav | Final URL | Notes |
| --- | --- | --- | --- | --- | --- |
| Self Service | /me | allowed | No | https://erp-staging.automatrix.pk/me | AutoMatrix Toggle theme IU AutoMatrix ERP v1.0 How this works My Dashboard Personal control panel for wallet, expenses, salary, and HR self-service. Available: PKR 0.00 Reimburse due: PKR 0.00 Submit Expense Wallet History Mark Attendance Apply Leave Profile Snapshot Personal ide |
| Employee Directory | /employees | allowed | No | https://erp-staging.automatrix.pk/employees | AutoMatrix Toggle theme IU AutoMatrix ERP v1.0 How this works Employees Employee directory. Add Employee Active 13 Inactive 0 Wallet Balance PKR 232,439.00 Wallet Hold PKR 0.00 Name Email Role Department Designation Wallet Status Actions Admin User admin@automatrix.local CEO - -  |
| Finance Workspace | /employees/finance-workspace | allowed | No | https://erp-staging.automatrix.pk/employees/finance-workspace | AutoMatrix Toggle theme IU AutoMatrix ERP v1.0 How this works Employee Finance Workspace Consolidated employee-level finance view for audit, reconciliation, and payout controls. Apply Select employee Admin User (admin@automatrix.local) Engineer 1 (engineer1@automatrix.pk) Finance |
| Employee Expense Report | /reports/employee-expenses | allowed | No | https://erp-staging.automatrix.pk/reports/employee-expenses | AutoMatrix Toggle theme IU AutoMatrix ERP v1.0 How this works Employee Expense Summary Approved expenses grouped by employee. Apply Export CSV Total Approved Expenses PKR 1,722,360.00 Employees 7 Records 136 Employee Email Records Total Approved Israr Ul Haq israrulhaq5@gmail.com |

## raoabdulkhaliq786@gmail.com

- Detected role: Accountant
- Objective pass count: 3
- Objective fail count: 0
- Objectives passed: Self-service portal works, Employee finance workspace works, Employee expense report works
- Objectives failed: None
- Effective permissions sample: accounting.manage, accounting.view, approvals.view_pending, attachments.view_all, audit.view, clients.view_all, commissions.approve, commissions.edit, commissions.view_all, company_accounts.manage, company_accounts.view, dashboard.view

| Objective | Route | Outcome | Direct Nav | Final URL | Notes |
| --- | --- | --- | --- | --- | --- |
| Self Service | /me | allowed | No | https://erp-staging.automatrix.pk/me | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 How this works My Dashboard Personal control panel for wallet, expenses, salary, and HR self-service. Available: PKR 60,000.00 Reimburse due: PKR 0.00 Submit Expense Wallet History Mark Attendance Apply Leave Profile Snapshot Persona |
| Employee Directory | /employees | allowed | No | https://erp-staging.automatrix.pk/employees | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 How this works Employees Employee directory. Add Employee Active 13 Inactive 0 Wallet Balance PKR 232,439.00 Wallet Hold PKR 0.00 Name Email Role Department Designation Wallet Status Actions Admin User admin@automatrix.local CEO - -  |
| Finance Workspace | /employees/finance-workspace | allowed | No | https://erp-staging.automatrix.pk/employees/finance-workspace | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 How this works Employee Finance Workspace Consolidated employee-level finance view for audit, reconciliation, and payout controls. Apply Select employee Admin User (admin@automatrix.local) Engineer 1 (engineer1@automatrix.pk) Finance |
| Employee Expense Report | /reports/employee-expenses | allowed | No | https://erp-staging.automatrix.pk/reports/employee-expenses | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 How this works Employee Expense Summary Approved expenses grouped by employee. Apply Export CSV Total Approved Expenses PKR 1,722,360.00 Employees 7 Records 136 Employee Email Records Total Approved Israr Ul Haq israrulhaq5@gmail.com |

## raomazeem1122@gmail.com

- Detected role: Guest
- Objective pass count: 1
- Objective fail count: 2
- Objectives passed: Self-service portal works
- Objectives failed: Employee finance workspace blocked, Employee expense report blocked
- Effective permissions sample: dashboard.view, employees.view_own, expenses.submit, expenses.view_own, projects.view_assigned

| Objective | Route | Outcome | Direct Nav | Final URL | Notes |
| --- | --- | --- | --- | --- | --- |
| Self Service | /me | allowed | No | https://erp-staging.automatrix.pk/me | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 How this works My Dashboard Personal control panel for wallet, expenses, salary, and HR self-service. Available: PKR 25,860.00 Reimburse due: PKR 0.00 Submit Expense Wallet History Mark Attendance Apply Leave Profile Snapshot Persona |
| Employee Directory | /employees | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Femployees | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Requested route: /employees Go to My Portal Go to Dashboard |
| Finance Workspace | /employees/finance-workspace | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Femployees%2Ffinance-workspace | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Requested route: /employees/finance-workspace Go to My Portal Go to Dashboard |
| Employee Expense Report | /reports/employee-expenses | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Freports%2Femployee-expenses | AutoMatrix Toggle theme MA AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Requested route: /reports/employee-expenses Go to My Portal Go to Dashboard |

## raoibrarulhaq1@gmail.com

- Detected role: Guest
- Objective pass count: 1
- Objective fail count: 2
- Objectives passed: Self-service portal works
- Objectives failed: Employee finance workspace blocked, Employee expense report blocked
- Effective permissions sample: dashboard.view, employees.view_own, expenses.submit, expenses.view_own, inventory.adjust, inventory.request, inventory.view, procurement.edit, procurement.view_all, projects.view_assigned, vendors.edit, vendors.view_all

| Objective | Route | Outcome | Direct Nav | Final URL | Notes |
| --- | --- | --- | --- | --- | --- |
| Self Service | /me | allowed | No | https://erp-staging.automatrix.pk/me | AutoMatrix Toggle theme MI OVERVIEW Dashboard My Portal My Expenses ERP Guide Notifications OPERATIONS Projects Procurement Inventory Warehouses FINANCE Vendor Bills PEOPLE Employee Finance Wallet Ledger Attendance Leave Incentives Salary Advances CONTROLS Master Data DIRECTORY V |
| Employee Directory | /employees | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Femployees | AutoMatrix Toggle theme MI AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Requested route: /employees Go to My Portal Go to Dashboard |
| Finance Workspace | /employees/finance-workspace | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Femployees%2Ffinance-workspace | AutoMatrix Toggle theme MI OVERVIEW Dashboard My Portal My Expenses ERP Guide Notifications OPERATIONS Projects Procurement Inventory Warehouses FINANCE Vendor Bills PEOPLE Employee Finance Wallet Ledger Attendance Leave Incentives Salary Advances CONTROLS Master Data DIRECTORY V |
| Employee Expense Report | /reports/employee-expenses | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Freports%2Femployee-expenses | AutoMatrix Toggle theme MI AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Requested route: /reports/employee-expenses Go to My Portal Go to Dashboard |

## raomubasher5555@gmail.com

- Detected role: Guest
- Objective pass count: 1
- Objective fail count: 2
- Objectives passed: Self-service portal works
- Objectives failed: Employee finance workspace blocked, Employee expense report blocked
- Effective permissions sample: dashboard.view, employees.view_own, expenses.submit, expenses.view_own, projects.edit, projects.update_status, projects.view_all, projects.view_assigned

| Objective | Route | Outcome | Direct Nav | Final URL | Notes |
| --- | --- | --- | --- | --- | --- |
| Self Service | /me | allowed | No | https://erp-staging.automatrix.pk/me | AutoMatrix Toggle theme MM AutoMatrix ERP v1.0 How this works My Dashboard Personal control panel for wallet, expenses, salary, and HR self-service. Available: PKR 61,820.00 Reimburse due: PKR 0.00 Submit Expense Wallet History Mark Attendance Apply Leave Profile Snapshot Persona |
| Employee Directory | /employees | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Femployees | AutoMatrix Toggle theme MM OVERVIEW Dashboard My Portal My Expenses ERP Guide Notifications OPERATIONS Projects PEOPLE Employee Finance Wallet Ledger Attendance Leave Incentives Salary Advances AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Reques |
| Finance Workspace | /employees/finance-workspace | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Femployees%2Ffinance-workspace | AutoMatrix Toggle theme MM OVERVIEW Dashboard My Portal My Expenses ERP Guide Notifications OPERATIONS Projects PEOPLE Employee Finance Wallet Ledger Attendance Leave Incentives Salary Advances AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Reques |
| Employee Expense Report | /reports/employee-expenses | forbidden | No | https://erp-staging.automatrix.pk/forbidden?from=%2Freports%2Femployee-expenses | AutoMatrix Toggle theme MM AutoMatrix ERP v1.0 Access Denied You do not have permission to open this page. Requested route: /reports/employee-expenses Go to My Portal Go to Dashboard |

