# ERP Diagrams (Phase 1 Blueprint)

These diagrams are a **living blueprint** of the current ERP spine.
Update this file whenever a workflow changes (schema/API/UI), so the CEO blueprint stays truthful.

## 1) Phase 1 Module Mindmap (Single-Spine)
```mermaid
mindmap
  root((AutoMatrix ERP))
    Phase 1 Spine (LOCKED)
      Procurement (P2P-lite)
        Vendors
        Purchase Orders (PO)
          DRAFT
          SUBMITTED
          ORDERED
          RECEIVED/PARTIALLY_RECEIVED
          CANCELLED
        Goods Receipt (GRN)
          DRAFT
          SUBMITTED
          APPROVED
          POSTED (creates InventoryLedger)
          VOID
        Vendor Bills (AP)
          DRAFT
          SUBMITTED
          APPROVED
          POSTED (AP truth via allocations)
          VOID
        Vendor Payments (AP)
          DRAFT
          SUBMITTED
          APPROVED
          POSTED (allocations)
          VOID
        Company Accounts (Cash/Banks)
      Inventory (Truth Source)
        Warehouse (Default)
        Item Master
        Inventory Ledger (only postings)
          sourceType/sourceId/postedBy/postedAt
        Valuation (Average Cost)
        Low Stock thresholds
      Controls (ERP-grade)
        RBAC (server enforced)
        Audit Log (every critical action)
        Lifecycle gates (no edits after POSTED)
      Reports (Truthful basics)
        AP Aging (from bills + posted allocations)
        Inventory On-hand (from item master + ledger)
        GRN Activity (from InventoryLedger sourceType=GRN)
        Approval/Queue counts (from SUBMITTED docs)
        Exceptions (blocked actions, missing items)
    Phase 1 Non-Spine / Legacy (read-only or limited)
      Expenses (Non-stock only)
        Must NOT create InventoryLedger
      Income (Legacy in Phase 1)
    Phase 2+ (OUT of Phase 1)
      Sales (O2C-lite)
      GL/COA/Journals
      Payroll maturity
      Projects/Tasks workflows
      Tax/FX/Bank Recon
```

## 2) Phase 1 Document Spine Flow (Truth Sources)
```mermaid
flowchart LR
  subgraph Procurement
    VND[Vendor]
    PO[Purchase Order]
    GRN[Goods Receipt (GRN)]
    BILL[Vendor Bill]
    PAY[Vendor Payment]
    CACCT[Company Account]
  end

  subgraph Inventory
    ITEM[Inventory Item Master]
    LEDGER[InventoryLedger (stock truth)]
  end

  subgraph AP
    APLEDGER[AP Truth (Bills - Posted Allocations)]
  end

  subgraph Controls
    RBAC[RBAC Server Checks]
    AUD[AuditLog]
  end

  VND --> PO --> GRN
  GRN -->|POST (explicit)| LEDGER
  ITEM <-->|qty/avg cost updates| LEDGER

  GRN --> BILL --> PAY --> CACCT
  BILL --> APLEDGER
  PAY -->|allocations| APLEDGER

  RBAC --- PO
  RBAC --- GRN
  RBAC --- BILL
  RBAC --- PAY

  AUD --- PO
  AUD --- GRN
  AUD --- BILL
  AUD --- PAY

  %% Guardrail (Phase 1): Expenses cannot do stock purchases.
  EXP[Expenses (Non-stock)] -. cannot post stock .-> LEDGER
```
