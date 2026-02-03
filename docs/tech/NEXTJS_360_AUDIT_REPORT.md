# Next.js ERP 360° Deep Audit Report (Low-Token / High-Signal)

Purpose: A concise but deep audit report optimized for another agent (e.g., Claude) to implement improvements with minimal back-and-forth and minimal token usage.

Scope:
- Product fit for real small business requirements
- Fine-grained access control (incl. column/field-level)
- Scalability for growth (100+ projects, 1k+ rows, many SKUs)
- UX/UI/layout and mobile readiness
- Engineering consistency and risk reduction

---

## A) Platform readiness: is the base ready for expansion + dynamic customization?

This section answers: *Can this ERP evolve into many modules (tasks, HR, payroll) and can admins customize behavior without code changes?*

### A1) Current state (summary)
- The project is a solid functional MVP (many modules exist), but it is **not yet a configurable platform**.
- Most business rules are encoded in **static code** (permissions map, category semantics, workflow rules), not in data.

### A2) What is “dynamic customization” in small business ERP terms?
Common real needs:
- Custom fields per company (e.g., Expense: `vehicleNo`, `driverName`, `jobCardNo`)
- Per-category rules (requires attachment, default account, approval thresholds)
- Per-project metadata and workflows
- Role/permission customization (including field-level visibility)
- Configurable numbering formats (invoice numbers, reference codes)

### A3) Where the current base blocks customization
- **Permissions** are hard-coded in `src/lib/permissions.ts` → not admin-configurable.
- **No policy/DTO layer** → cannot safely implement field-level permissions.
- **No organization/tenant model** → future SaaS/multi-company customization is hard.
- **Master data** (categories/payment modes/income sources) appears mostly “simple lists” → lacks rule metadata.
- **Workflow rules** (approvals thresholds and routing) are not clearly centralized/configurable.

### A4) What is already good (you can build on it)
- NextAuth + Prisma is a reasonable base.
- Clear separation of API routes per module.
- Existing lists, dialogs, forms provide reusable UI patterns.

### A5) Minimal platform upgrades to enable dynamic needs (recommended)
1) Add a **Policy + DTO layer** (server-side) so you can implement field-level access + safe response shaping.
2) Add **Rule metadata** to master data (Category, PaymentMode, etc.) so behavior can be changed without code.
3) Add `Organization` scoping if multi-company is planned.
4) Introduce a **Custom Fields** pattern early (JSON fields + schema) to avoid schema churn.

---

## B) Product fit: where it won’t meet real small-business operations (as-is)

### A1) Growth paths are not designed (100+ projects, 1,000+ expenses, many SKUs)
**Symptoms you will hit quickly**
- “By project” views become unusable when projects exceed ~30–50 unless you add search, filters, grouping, saved views, and “recent projects”.
- Reporting becomes “toy-level” without dimensions: project, category, supplier, employee, payment source, cost center, client, invoice linkage.

**Missing (high impact)**
- Saved filters/views (“My Projects”, “Active Projects”, “This month’s pending approvals”).
- Global search (projects, invoices, inventory items, employees).
- Work queues (“needs approval”, “needs payment”, “needs stock adjustment”, “invoice overdue”).

### A2) Approvals workflow is incomplete for real finance ops
Most small businesses need:
- Multi-step approvals (Manager → Finance → Owner) depending on thresholds and category.
- Delegation / backup approver.
- Audit trail: who approved, when, what changed.

Approvals exist, but policy, scopes, reporting, and enforced filtering are not mature.

### A3) Inventory is not a product system yet
Real inventory needs:
- Product types and variants (size/color/material/packaging).
- SKU identity, barcode, units, conversions (box → unit).
- Costing method (FIFO/weighted average), purchase lots, supplier history.
- Stock locations (warehouse/bin), reorder points, lead time.

Current implementation is closer to a ledger than a product catalog.

### A4) Invoices/projects not fully connected financially
Small business reality:
- Expenses and income should be attributable to projects/clients/invoices.
- Profitability should reconcile with invoicing and cash collected.

---

## B) Data model audit (Prisma): key structural limitations

### B1) No multi-tenant boundary
If this ERP is for “small business” generally (multiple businesses), you need:
- `Organization` (company)
- every row scoped by `organizationId`
- membership model: `UserOrganization`, roles per org

Without this, future “multiple businesses” becomes unsafe and expensive.

### B2) Inventory needs normalization (Products + Variants)
“Category as string” won’t scale.

**Recommended minimal model (practical, not overbuilt):**
- `ProductCategory` (e.g., Tyre, Oil, Part)
- `Product` (name, brand, description, baseUnit, categoryId)
- `ProductVariant` (productId, sku, attributes JSON: `{size, color}`, barcode, unitPrice, active)
- `InventoryLot` (variantId, qty, cost, purchasedAt, supplierId)
- `StockLedger` (variantId, deltaQty, reason, referenceType/id, createdById)

Start flexible with JSON attributes; enforce templates later.

### B3) Projects at 100+ need status + indexing + quick selectors
Add:
- `status` (Active/OnHold/Completed/Archived)
- `code` (short identifier users can search)
- Indexes on `(status, name)` and `(organizationId, status)` once multi-tenant exists.

### B4) Categories/payment modes/income sources
These should be organization-scoped and optionally hierarchical:
- `Category` with `type` (expense/income/inventory)
- optional `parentId`
- flags: `active`, `requiresProject`, `requiresAttachment`, `approvalThresholdOverride`

---

## C) Access control: current state vs “column-level deep”

### C1) Current RBAC is coarse and partially inconsistent
- Static permissions map is OK for MVP but must be consistently enforced server-side.
- Some endpoints/pages effectively allow “logged in = allowed”.
- Permission naming inconsistencies cause silent authorization failures or unintended access.

### C2) No data/field-level security (required for “column-level deep”)
To be truly column/field-level:
1) Policy model (field read/write permissions)
2) Response shaping (server never returns forbidden fields)
3) UI shaping (hide/disable fields and columns)

**Minimal secure approach**
- Define DTO serializers per entity:
  - `toExpenseDTO(expense, ability)` removes `amount`, `paymentSource`, etc.
- Add permissions like:
  - `expenses.field.amount.read`
  - `employees.field.salary.read`
  - `projects.field.financials.read`

### C3) Attachments are security-sensitive
Attachments often include bills, invoices, IDs.
Must enforce:
- Attachment belongs to a parent record (expense/invoice/etc)
- Permission to parent is required to access attachment
- Store with signed URLs or controlled route streaming

### C4) Dashboard and reports are common leak points
Dashboards aggregate everything and can leak global totals.
Rule:
- All dashboard/report endpoints require explicit permissions and scope filters (own/team/all/org).

### C5) Audit logs must be restricted
Audit logs can reveal sensitive fields.
Needs:
- Redaction / field filtering
- Strict permission gates

---

## D) Scalability/performance audit (100 projects, thousands of rows)

### D1) Project selection at scale (100+ active projects)
Replace large dropdowns with async searchable combobox + “recently used”.
- Server: `/api/projects?query=&status=Active&limit=20`
- UI caches last selections; pin favorites.

Add a “Project picker” modal: search + filters (status, client, manager).

### D2) List pages need consistent server-side pagination + search
Ensure all list endpoints support:
- `take`, `skip`, `orderBy`, `where` with indexed fields
- Avoid “last 100” defaults

### D3) Reporting/export needs background jobs
Exports will become heavy.
Plan:
- `ExportJob` table + async generation
- Notify user when ready

### D4) N+1 queries & include/select discipline
Standardize Prisma usage:
- Always `select` only needed fields
- Avoid heavy `include` on lists
- Create dedicated projections for list endpoints

---

## E) UX/UI/layout/mobile audit (what will feel broken to users)

### E1) Navigation must be permission- and role-aware
Users should not see menu items they can’t use.
- Central nav config with required permissions
- Render only allowed items (or disabled + tooltip if desired)

### E2) Mobile-first table strategy is incomplete
Tables don’t translate to mobile.
For each major list (expenses, inventory, invoices):
- Desktop: table with column controls
- Mobile: card layout with 3–5 key fields + actions via kebab menu

### E3) Forms need “business-safe defaults”
- Default date = today
- Default project = last used
- Default payment mode = most frequent
- Require attachments for certain categories
- Validation explains the rule (“Fuel expenses require a receipt”)

### E4) Information architecture for 100 projects
- Projects list: status tabs (Active/Completed/Archived), search, filters
- Project details: summary + tabs (Expenses, Income, Invoices, Inventory usage, Approvals)
- Global create button: contextual menu filtered by permissions

### E5) Accessibility / consistency
- Consistent primary action placement
- Confirm destructive actions
- Standard toast/notification patterns

---

## F) Engineering/process issues that will slow development

### F1) Static permissions in code but roles/permissions in DB
Mismatch. Choose one:
- **Option A (fast):** keep static permissions map; store role name on user; ignore/remove DB permission tables.
- **Option B (scalable):** use DB permissions fully; add admin UI; cache permissions.

Low-token recommendation: pick A short-term; abstract via “permission provider interface” to migrate later.

### F2) Missing “central policy enforcement” layer
Avoid copy-paste in routes.
Create:
- `getCurrentUserOrThrow()`
- `assertPermission(user, perm)`
- `scopeWhere(user, entity)` for own/team/all
- `toDTO(entity, user)` for field filtering

### F3) Tests are thin for auth/perms
Add:
- Unit tests: `hasPermission`, scope filters, DTO redaction
- Playwright: staff cannot see global dashboard totals; cannot download others’ attachments

---

## G) Future roadmap (not current scope, but design-impacting)

These are likely next-phase modules for a growing ERP. Even if not implemented now, the *current architecture should not block them*.

### G1) Work/task management (project execution)
- Projects → milestones → tasks → subtasks
- Assignments (who), scheduling (when), status, dependencies
- Time logs / work logs (optional)
- Comments, attachments, activity feed
- Notifications + reminders
- Performance views: planned vs done, cycle time, throughput

### G2) Employee portfolio / profile
- Profile: skills, certifications, documents
- Leave history and balances
- Pay history (salary revisions, allowances)
- Assigned task history + completion analytics
- Disciplinary notes / reviews (sensitive; requires strict field-level access)

### G3) Attendance
- Shifts, check-in/out, late/early rules
- Holidays, off days, overtime
- Location/device rules if needed

### G4) Payroll
- Salary structures, components, deductions
- Payslips, approvals, payroll runs
- Tax/benefit rules (country-specific)

**Design implications now**
- Add `Organization` + per-org scoping early if multi-tenant is planned.
- Adopt field-level redaction patterns now (payroll and HR data demands it).
- Build a reusable “workflow/approval engine” now (tasks, leave, payroll all reuse approvals).

---

## H) “Claude low-token execution checklist” (do these in order)

### Phase 1 — Stop data leaks + enforce consistent permissions (highest ROI)
1) Create shared module: `src/lib/access/`
   - `auth.ts` (get session user)
   - `permissions.ts` (normalize constants)
   - `policy.ts`
     - `assertPermission(user, perm)`
     - `scopeWhere(user, resource)`
     - `redactExpense(expense, user)` etc.
2) Patch endpoints that currently only check “logged in”:
   - Dashboard
   - Attachments
   - Reports/export
   - Audit
3) Add permission-aware sidebar; hide admin links by permission.

### Phase 2 — Make UI usable at 100 projects / thousands of rows
4) Implement `ProjectAutoComplete` everywhere projects are selected:
   - Async search endpoint
   - Recent projects cache (localStorage)
5) Standardize list pages:
   - Pagination, search, filters, status tabs
6) Mobile:
   - Table + card dual rendering

### Phase 3 — Inventory becomes a real product system (minimum viable)
7) Introduce `Product`, `ProductVariant`, `ProductCategory`
8) Update inventory flows:
   - Create product with variants
   - Stock ledger by variant
   - Basic reorder alerts

### Phase 4 — Real small-business governance
9) Add organization/tenant support if needed.
10) DB-driven permissions if needed.

---

## Definitions of Done for Key Pain Points

### “100 active projects”
- Project picker is searchable, async, fast (<200ms typical)
- Projects list has status tabs + search + pagination
- Project-wise expenses page supports filtering (date/category/status) and is mobile-usable

### “Inventory categories imply product type, details, variations”
- Category selects a product type template
- Product can have variants (size/color) without name hacks
- Inventory ledger operates on SKUs/variants

### “Column-level access control”
- API never returns forbidden fields
- UI hides forbidden columns/inputs
- Audit log/redactions follow same rules
