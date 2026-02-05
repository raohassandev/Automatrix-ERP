# ERP Diagrams (Draft)

These diagrams show the current module map and cross-module flows.
Names can be refined later without changing the structure.

## 1) Module Mindmap
```mermaid
mindmap
  root((Automatrix ERP))
    Overview
      Dashboard
      My Dashboard
      Notifications
    HR & Admin
      Employees
        Personal Info
        Education
        Experience
        Department
        Designation
        Reporting Officer
        Salary Package
      Salary Advances
      Roles & Permissions (future)
    Finance
      Expenses
        Salary Expense
        Incentive Expense
        Commission Expense
        Procurement Expense
        Project Direct Expense
      Payroll
        Monthly (Previous Month)
      Incentives
        Project Completion Only
      Wallet Ledger
      Income/Receipts
      Approvals
    Projects/Engineering
      Projects
        Status: Not Started/Upcoming
        Status: Active
        Status: On Hold
        Status: Completed
        Status: Closed
      Project Financials
      Project Expenses View
    Procurement/Store
      Purchase Orders
      Goods Receipts (GRN)
      Vendor Records (future)
    Inventory
      Items
      Ledger (Stock In/Out)
      Last Purchase Price
      Avg Cost
    CRM/Sales
      Clients
      Quotations
      Invoices
      Commissions
    Reports
      Expenses
      Inventory
      Wallets
      Projects
      Procurement
      Employee Expenses
```

## 2) Cross-Module Flow Diagram
```mermaid
flowchart LR
  subgraph HR
    EMP[Employee Master Profile]
    ADV[Salary Advance]
  end

  subgraph Finance
    PAY[Payroll Run]
    INC[Incentive Approval]
    EXP[Expense Ledger]
    WAL[Wallet Ledger]
    APR[Approvals]
  end

  subgraph Projects
    PROJ[Project Status]
  end

  subgraph Procurement
    PO[Purchase Order]
    GRN[Goods Receipt]
  end

  subgraph Inventory
    INV[Inventory Ledger]
  end

  subgraph CRM
    QUO[Quotation]
    INVCE[Invoice]
    COMM[Commission]
  end

  EMP --> PAY
  ADV --> WAL

  PAY -->|Approve| EXP
  PAY -->|Approve| WAL

  PROJ -->|Completed/Closed| INC
  INC -->|Approve| EXP
  INC -->|Approve| WAL

  COMM --> EXP

  PO --> GRN --> INV

  QUO --> INVCE --> EXP

  APR --> PAY
  APR --> INC
  APR --> COMM
```
