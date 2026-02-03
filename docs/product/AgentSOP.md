# Agent SOP — AutoMatrix ERP (C&I Engineering)

**Purpose:** Clear, minimal rules to build and maintain the ERP without confusion or rework.

---

## 1) Scope
This ERP is for C&I engineering operations. It must support:
- Clients, Projects, Employees, Inventory
- Expenses, Income, Approvals
- Employee Wallet
- Project‑wise expense tracking
- Role‑based access control

---

## 2) Non‑negotiable Rules
- **Every module must have CRUD** (create, read, update, delete).
- **Every API must enforce permissions** (no UI‑only checks).
- **All financial actions must be logged** in AuditLog.
- **Field‑level access** must be enforced for sensitive fields (purchase price, selling price, wallet).

---

## 3) Development Workflow
1. Update Prisma schema
2. Update API validation
3. Update API route
4. Update UI form
5. Add audit logging
6. Test

No exceptions.

---

## 4) Permissions (Roles)
- CEO: full access
- Admin: user management + system settings
- Finance/Accounts: approvals, wallet, reports
- Procurement: inventory + purchase price
- Store Keeper: stock in/out, no purchase price edit
- Sales: view selling price, project pipeline
- Marketing/Sales Manager: update project info + payments
- Engineering/PM: project updates + project expenses
- Employee: own wallet + submit expenses

---

## 5) Data Standards
- Project ID comes from quotation (external).
- Clients are separate entity with contacts.
- Expenses must always link to a project.
- Inventory items must carry purchase + selling prices.

---

## 6) Testing
- Test each CRUD flow before moving on.
- Use role‑based tests to confirm restricted access.

---

## 7) Documentation
Keep docs minimal:
- `MASTER_PLAN.md`
- `docs/README.md`
- `docs/product/AgentSOP.md`

