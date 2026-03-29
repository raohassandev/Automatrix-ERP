# Automatrix ERP Master Completion Plan for Codex

**Prepared for:** Automatrix / Codex  
**Date:** 2026-03-12  
**Purpose:** Provide one authoritative implementation plan, recommendation set, and working guideline for completing the already-implemented ERP modules to a production-controlled state.  
**Scope rule:** This document is for **implemented modules only**. It is **not** permission to expand into unimplemented master-plan modules.

---

## 1. Executive mandate

Automatrix ERP should become a **document-driven, permission-shaped operating system** for your business.

The target is not “more pages.” The target is:

1. each user updates only the data they own,
2. approvals happen in the right place,
3. the ERP converts those actions into one truthful operational and financial state,
4. managers/CEO/controllers can see what is pending, due, blocked, paid, overdue, and reversed,
5. every important movement is auditable end to end.

This means the project must stop behaving like a collection of forms and start behaving like a **controlled transaction system**.

---

## 2. What “complete” means for this ERP

This ERP is complete only when the following are true:

- a user can open their workspace and immediately know what they must do,
- every money movement has a source document, approval path, posting event, settlement state, and audit trail,
- payroll answers month-by-month questions without manual interpretation,
- incentive and commission handling is part of one controlled variable-pay model,
- salary advances and reimbursements are not mixed into salary in an ad hoc way,
- project profitability is based on controlled facts, not optimistic or mixed-status totals,
- procurement, stock receipt, vendor liability, and payment flow are tied together correctly,
- dashboards are drillable control surfaces, not decorative summaries,
- posted or paid records are corrected by reversal or supersession, not by deletion.

If any of the above is still missing, the ERP is still in hardening stage.

---

## 3. Scope boundaries

### In scope

- Auth / RBAC / permission-shaped views
- Employees / departments / designations
- Clients / quotations / projects / assignments
- Tasks
- Expenses
- Salary advances
- Incentives and employee commissions
- Payroll
- Attendance / leave
- Inventory
- Procurement: PO, GRN, vendor bill, vendor payment
- Invoices / income / company accounts / cash position
- Accounting / journals / fiscal periods / reports
- Dashboards: self-service, manager, finance, CEO / owner
- Audit logs / notifications / attachments / approvals

### Out of scope

- any unimplemented module from the super master plan,
- manufacturing / BOM / MRP / production / work orders,
- advanced tax/localization engines beyond what current scope absolutely requires,
- major module expansion unrelated to cash flow, projects, inventory, task management, and HRMS integrity.

**Rule:** Do not start any new large module until the in-scope modules below are completed and verified.

---

## 4. Non-negotiable design rules

These rules are the implementation contract. Codex should follow them unless you explicitly override one.

### 4.1 One business event, one primary document
A business event must be represented by one primary source document. Reports and dashboards must derive from that document and its controlled downstream records.

Examples:
- employee advance request -> advance payment -> claim / return / recovery
- payroll run -> payroll entry -> disbursement
- purchase order -> goods receipt -> vendor bill -> vendor payment
- invoice -> receipt allocation

### 4.2 Separate operational state from accounting state from settlement state
Every major document should distinguish at least these concepts:
- **workflow state**: draft / submitted / approved / rejected / cancelled
- **posting state**: unposted / posted / reversed
- **settlement state**: unpaid / partially paid / paid / reimbursed / recovered / returned

These must not be collapsed into one status field.

### 4.3 No destructive delete after approval or posting
After approval, posting, or payment, the system must use:
- reject,
- cancel,
- reverse,
- supersede,
- re-open with audit reason,

not hard delete.

### 4.4 Salary is not the same thing as reimbursement
An employee reimbursement is not salary. A salary advance is not salary. A wallet entry is not salary. They may interact with payroll only by an explicit, traceable rule.

### 4.5 Variable pay must be month-aware
All incentives and employee commissions must carry:
- earning month,
- approval month,
- settlement channel,
- scheduled payroll month or payment due date,
- settlement reference,
- paid month.

Without those fields, management cannot answer “what belongs to which month?”

### 4.6 All posted financial effects go through one posting service layer
Do not scatter GL logic across route handlers. The posting contract must remain centralized and idempotent.

### 4.7 Period locking is mandatory
Once a fiscal period is closed, the ERP must prevent new postings in that period except through controlled reversal/reopen logic.

### 4.8 Dashboards must be actionable
Every dashboard tile/card must drill into a filtered list that explains the number shown.

### 4.9 Projects must show three truths separately
Project views must clearly separate:
- **committed** cost,
- **actual posted** cost,
- **cash settled** amount.

Mixing these destroys trust in project reporting.

### 4.10 Every material action needs auditability
For approvals, posting, settlement, reversals, and manual overrides, capture:
- who,
- when,
- why,
- linked record,
- before/after effect when relevant.

---

## 5. Benchmark principles from mature ERP systems

This plan is aligned with patterns already solved by established ERP products.

- **Payroll should be batch-based and month-aware.** Odoo organizes payslips by batch and status, while payroll inputs include deductions, reimbursements, and other inputs; work entries feed payroll calculations and conflicts are resolved before payslip generation. ERPNext bulk-processes payroll through Payroll Entry and separates salary accrual from the salary payment voucher/bank entry.
- **Variable pay should be attached to an explicit payroll or pay date.** ERPNext’s Additional Salary uses a payroll date so ad hoc pay items such as incentives or arrears land in a specific payroll cycle. SAP’s variable pay guidance also emphasizes eligibility, proration, validation reports, payout reporting, and publishing with a pay date.
- **Employee advances should have their own lifecycle.** Frappe HR/ERPNext models employee advances through states such as Paid, Claimed, Returned, and Partly Claimed and Returned, and creates accounting only when the advance is actually paid. Oracle and Dynamics 365 both treat cash advances as a distinct process with due dates, application against expense reports, and overdue tracking.
- **Reimbursements should remain distinct from salary unless explicitly routed through payroll.** Odoo supports paying approved expenses directly or reporting them in the next payslip, and ERPNext explicitly warns that expense-claim payment should not simply be clubbed with salary because that changes employee treatment.
- **Stock items should use perpetual inventory timing.** ERPNext’s perpetual inventory model recognizes stock receipt accounting and uses a temporary “stock received but not billed” style clearing account until the vendor invoice arrives.
- **Vendor invoices for stock items should respect matching controls.** Dynamics 365 documents two-way and three-way matching between PO, product receipt, and invoice quantity/price, including tolerance handling.

These are not suggestions to clone those ERP systems. They are the control patterns Automatrix ERP should adopt.

---

## 6. The target operating model

The ERP should operate around **control registers**. These can be implemented as query services, SQL views/materialized views, or carefully built reporting functions. They do not have to be separate tables unless needed.

### 6.1 Payroll Control Register
Purpose: answer, by month and employee:
- base salary,
- attendance/leave effect,
- variable pay included,
- reimbursement included in payroll,
- advance recovery,
- gross,
- deductions,
- net,
- approval state,
- posting state,
- payment state,
- payment account / ref,
- overdue flag.

Minimum columns:
- employee
- payroll month
- period start / end
- run id / entry id
- base salary
- earnings total
- deductions total
- variable pay total
- reimbursements-in-payroll total
- advance recovery total
- net payable
- approved at
- posted at
- paid at
- payment mode
- company account
- payment reference
- current status

### 6.2 Variable Pay Register
Purpose: manage project incentives and employee commissions with month control.

Minimum columns:
- source type (INCENTIVE / COMMISSION)
- employee
- project / task / source reference
- earning month
- basis amount / rate / rule version
- approved amount
- approver and approval date
- settlement channel (PAYROLL / AP / DIRECT / WALLET only if explicitly allowed)
- scheduled payroll month or due date
- settled in payroll entry / vendor bill / payment reference
- paid month
- settlement status
- reversal status if any

### 6.3 Employee Settlement Register
Purpose: unify everything the company owes to or is owed by an employee.

Minimum columns:
- employee
- obligation type (ADVANCE / REIMBURSEMENT / PAYROLL / RECOVERY / RETURN / WALLET)
- source document
- approved amount
- open balance
- due date
- aging bucket
- settlement channel
- linked payment / payroll entry / journal
- current status

### 6.4 Project Financial Register
Purpose: give management a truthful per-project view.

Minimum columns:
- project
- contract value
- invoiced
- received
- overdue receivable
- committed procurement
- posted inventory receipt value
- posted vendor billed value
- posted vendor paid value
- posted employee expense value
- posted payroll allocation value if applicable
- actual cost total
- gross margin
- gross margin %
- unresolved mismatches/exceptions

### 6.5 Procurement and AP Register
Purpose: show where each purchasing document stands.

Minimum columns:
- PO no.
- vendor
- project
- ordered quantity/value
- received quantity/value
- billed quantity/value
- paid value
- open value
- blocked by matching issue?
- reversal/correction state

### 6.6 Cash Control Register
Purpose: show cash position and near-term obligations.

Minimum columns:
- company account
- current balance snapshot
- uncleared receipts
- uncleared payments
- payroll due
- approved reimbursements due
- vendor payments due
- upcoming collections
- forecast window (7/30 days)

### 6.7 Task and Approval Register
Purpose: turn tasks and approvals into a role-based work queue.

Minimum columns:
- item type
- title
- owner
- assigned to
- due date
- overdue flag
- blocking reason
- linked module record
- required action
- priority

---

## 7. Role-based workspace design

The ERP already has multiple pages. Completion should focus on **re-composing** them into workspaces rather than creating many new destinations.

### 7.1 My Workspace
Audience: every employee.

Must show:
- my tasks due/overdue,
- my expense drafts / pending approvals / reimbursements due,
- my salary advances and balances,
- my payroll history by month,
- my approved but unscheduled variable pay,
- my attendance / leave exceptions,
- my notifications.

### 7.2 Manager Workspace
Audience: project managers / department heads / approvers.

Must show:
- approvals awaiting me,
- project task delays,
- project budget/cost exceptions,
- team expense requests,
- team attendance exceptions,
- variable pay awaiting review,
- projects with overdue billing/collection issues.

### 7.3 Finance Control Workspace
Audience: finance / accounts / controllers.

Must show:
- reimbursements due,
- advances overdue / unreconciled,
- payroll runs awaiting approval/posting/payment,
- variable pay scheduled for current payroll,
- unpaid vendor bills,
- bills blocked by matching discrepancy,
- unapplied receipts,
- bank reconciliation exceptions,
- period-close checklist.

### 7.4 Procurement and Store Workspace
Audience: procurement / inventory / warehouse.

Must show:
- PO awaiting approval,
- overdue GRN pending vendor bill,
- stock negative / low stock / blocked reversals,
- vendor bill quantity/price mismatch,
- receipts with no invoice beyond threshold.

### 7.5 HR and Payroll Workspace
Audience: HR / payroll owner.

Must show:
- attendance conflicts,
- leave approvals,
- compensation profile exceptions,
- pending variable pay for next payroll,
- open advances to recover,
- payroll draft/approved/paid status by month,
- employees missing salary structure / compensation setup,
- payroll disbursement gaps.

### 7.6 CEO / Owner Workspace
Audience: CEO / owner / assigned controllers.

Must show:
- cash in bank,
- receivable due / overdue,
- payable due / overdue,
- payroll due this month,
- unrecovered employee advances,
- projects with negative margin or low recovery,
- top operational bottlenecks,
- audit exceptions and high-risk reversals.

**Important:** dashboard cards are not enough. Every metric must open a filtered detail list.

---

## 8. Module-by-module completion guidance

## 8A. Projects, quotations, invoices, income, and collections

### Objective
Make project commercial control truthful from quotation to cash collection.

### Required flow
Quotation -> approved quotation -> project creation -> project assignments / tasks / procurement / expenses -> invoice -> receipt allocation -> overdue control.

### Completion rules
- project creation from quotation must copy commercial truth cleanly,
- project status must not imply financial settlement,
- project financial summary must use **posted** cost and **allocated** receipts,
- invoice receipts must not over-allocate,
- project profitability must show actual vs committed vs received separately,
- reversing an invoice or receipt must update project views through the same source-of-truth query layer.

### Strong recommendation
Build project financials from subledgers/registers, not from manually maintained cached totals alone. Cached summaries are allowed only if there is a guaranteed rebuild path and drift detection.

### Acceptance criteria
- for any project, management can answer: contract value, invoiced, received, receivable overdue, committed procurement, actual cost posted, gross margin,
- every number drills down to underlying documents,
- project detail never mixes draft/unapproved/unposted facts into “actual” figures.

### Likely code areas
- `src/lib/projects.ts`
- `src/app/projects/**`
- `src/app/api/projects/**`
- `src/app/invoices/**`
- `src/app/api/invoices/**`
- `src/app/income/**`
- `src/app/api/income/**`
- `src/lib/invoice-allocation.ts`

---

## 8B. Task management

### Objective
Make tasks operationally useful instead of isolated records.

### Completion rules
- every task must have clear owner, assignee, due date, priority, and blocking state,
- project tasks and self-service tasks may share UI patterns but must not blur financial approvals into generic tasks,
- overdue and blocked tasks must appear on workspace dashboards,
- task completion should not silently close financial or approval obligations.

### Acceptance criteria
- managers can see overdue tasks by project and assignee,
- employees can see only their own action list unless permission allows wider view,
- task counts on dashboards always drill to the underlying filtered list.

### Likely code areas
- `src/lib/tasks.ts`
- `src/app/tasks/**`
- `src/app/api/tasks/**`
- workspace/dashboard query builders

---

## 8C. Expenses and reimbursements

### Objective
Make expense handling controlled, auditable, and compatible with employee advances and project costing.

### Required distinction
There are four different realities and the ERP must treat them differently:
1. company-paid purchase / company account spend,
2. employee own-pocket expense awaiting reimbursement,
3. advance-funded expense that clears an employee advance,
4. payroll-routed reimbursement approved for a specific payroll month.

### Strong recommendations
- do not use a single generic expense status for all four realities,
- do not treat “approved expense” as already reimbursed,
- do not block own-pocket expenses with a crude global rule when an advance exists; instead require advance application or documented justification at claim time for the relevant project/purpose,
- store `reimbursableAmount`, `advanceAppliedAmount`, `companyPaidAmount`, and `reimbursementBalance` explicitly or derive them consistently,
- permit direct reimbursement payment or scheduled payroll reimbursement only when the chosen channel is explicit and auditable,
- if reimbursement is scheduled through payroll, store the target payroll month and link the eventual payroll entry.

### Required expense lifecycle
Draft -> Submitted -> Approved -> Posted ->
- Company Paid / No Reimbursement Due, or
- Reimbursement Pending -> Reimbursed, or
- Scheduled for Payroll -> Settled in Payroll,
with reversal/cancellation paths.

### Acceptance criteria
- the system can answer which expenses are approved but unpaid,
- which are reimbursed outside payroll,
- which are scheduled into which payroll month,
- which advances were applied against which expense lines,
- which projects absorbed which posted expense amounts.

### Likely code areas
- `src/app/expenses/**`
- `src/app/api/expenses/**`
- `src/lib/approval-engine.ts`
- `src/lib/validation.ts`
- dashboard/self-service query layers

---

## 8D. Salary advances

### Objective
Treat salary/employee advances as a controlled employee-settlement process, not a shortcut deduction mechanism.

### Strong recommendations
- distinguish **advance request** from **advance payment**,
- store purpose, project reference if applicable, due date, and intended settlement path,
- do not recover every paid advance automatically through next payroll unless policy explicitly requires it,
- apply advances first against linked expense claims when the advance was for spend,
- permit return of unused advance separately from payroll deduction,
- mark overdue advances clearly for finance and management,
- maintain separate fields for issued, claimed, returned, recovered through payroll, and current open balance.

### Required advance lifecycle
Draft -> Submitted -> Approved -> Paid ->
- Open,
- Partly Claimed,
- Claimed,
- Partly Returned,
- Returned,
- Partly Recovered via Payroll,
- Fully Recovered,
with cancellation / reversal rules.

### Acceptance criteria
- finance can see every open advance and how it will clear,
- the ERP can distinguish unused returned cash from payroll recovery,
- employee self-service shows exact remaining balance and linked expense/return/recovery records,
- overdue balances are visible in manager/finance/CEO views.

### Likely code areas
- `src/app/salary-advances/**`
- `src/app/api/salary-advances/**`
- `src/components/SalaryAdvance*`
- `src/lib/payroll-policy.ts`
- employee settlement queries

---

## 8E. Payroll, attendance, and leave

### Objective
Turn payroll into a professional month-aware control process.

### Strong recommendations
- payroll must run by payroll month / period and produce a clear batch/run,
- attendance and leave must be frozen or conflict-checked before payroll computation,
- payroll computation should draw from compensation profile, attendance inputs, approved additional inputs, approved variable pay scheduled for that month, and approved recoveries,
- salary accrual and salary payment must remain separate events,
- payroll payment must use company account/bank information and leave an audit trail,
- payroll status must support at least Draft -> Computed -> Approved -> Posted -> Paid -> Closed, with reversal or reopen under control,
- employees need payslip-like visibility by month even if the UI is custom.

### Required payroll components
Base salary, allowances, deductions, variable pay, reimbursements-in-payroll, advance recovery, attendance penalty, leave effect, net pay.

### Critical fix
Current payroll logic should stop being the only place where variable pay and advance recovery meaning is decided. Payroll should **consume** already-controlled inputs, not invent business semantics at pay time.

### Acceptance criteria
For any month, the ERP must answer:
- who is included in payroll,
- what is base salary,
- what variable pay is included and why,
- what reimbursement is included and why,
- what advance recovery is included and why,
- what is approved but not yet posted,
- what is posted but unpaid,
- what is overdue,
- what has been paid from which account and reference.

### Likely code areas
- `src/lib/payroll-policy.ts`
- `src/lib/payroll-settlement.ts`
- `src/app/payroll/**`
- `src/app/api/payroll/**`
- `src/app/hrms/attendance/**`
- `src/app/hrms/leave/**`
- `src/app/api/hrms/**`
- `src/components/Payroll*`

---

## 8F. Incentives and employee commissions (Variable Pay subsystem)

### Objective
Replace ad hoc incentive/commission handling with one professional variable-pay model.

### Strong recommendations
- conceptually merge employee incentives and employee commissions under one **Variable Pay** control model,
- retain separate source forms if needed, but normalize them into one register/query layer,
- capture earning month, source basis, approved amount, scheduled payroll month or settlement date, and final settlement channel,
- do not create final accounting or payment truth at approval unless that is the actual business event,
- for employee variable pay routed through payroll, create a controlled payroll input linked to the variable-pay source,
- for third-party or middleman commissions, route through AP with vendor bill/payment linkage and keep the commission register in sync.

### Minimum variable-pay fields
- source type
- source id
- employee / vendor payee
- project ref
- earning month
- basis type and basis value
- rule version
- approved amount
- payout mode
- scheduled payroll month or due date
- settled by record id
- paid month
- settlement status

### Recommended statuses
Draft -> Submitted -> Approved -> Scheduled -> Settled -> Reversed.

### Acceptance criteria
- management can see variable pay earned this month, approved this month, scheduled into next payroll, paid outside payroll, and still pending,
- no approved variable pay disappears from control views,
- one employee can open a monthly history of all variable pay lines and how each was settled,
- AP-routed commissions reconcile to vendor-bill and payment records.

### Likely code areas
- `src/app/incentives/**`
- `src/app/api/incentives/**`
- `src/app/commissions/**`
- `src/app/api/commissions/**`
- payroll input and dashboard query layers
- accounting posting hooks

---

## 8G. Procurement, inventory, vendor liabilities, and payments

### Objective
Make stock and AP flow trustworthy from order to payment.

### Required stock-item flow
PO -> approved PO -> GRN -> stock / inventory ledger update -> vendor bill with matching validation -> vendor payment allocation -> reversal when needed.

### Strong recommendations
- stock items must use perpetual inventory timing,
- GRN for stock items should create inventory impact and temporary clearing liability until billed,
- vendor bills for stock items should be matched against PO/GRN quantity and price,
- mismatches must be visible and either blocked or routed through controlled override,
- vendor payment must allocate against vendor bills, not float free without reference,
- reversal paths must exist for posted GRN, posted vendor bill, and posted vendor payment,
- non-stock spend must go through expense/AP logic, not inventory logic.

### Acceptance criteria
- finance can explain ordered, received, billed, paid, and outstanding by vendor and project,
- inventory quantity and inventory value reconcile to ledger movements,
- vendor bill posting cannot ignore major quantity/price mismatches,
- reversal leaves a visible audit trail and reverses related posting correctly.

### Likely code areas
- `src/app/procurement/**`
- `src/app/api/procurement/**`
- `src/app/inventory/**`
- `src/app/api/inventory/**`
- `src/lib/accounting.ts`
- reporting queries under procurement / inventory / AP reports

---

## 8H. Cash flow, company accounts, AR/AP control, and accounting

### Objective
Make cash position and management reporting truthful and drillable.

### Strong recommendations
- all financial events must post through the accounting service layer,
- bank/company-account balance views must distinguish book balance vs reconciled balance vs uncleared items,
- unapplied receipts and unapplied payments need explicit visibility,
- AR aging and AP aging must derive from posted documents and allocations,
- cash forecast should at minimum combine bank balances, expected collections, due vendor payments, due reimbursements, and due payroll,
- period-close checklist must highlight unresolved exceptions before close.

### Acceptance criteria
- Trial Balance, P&L, Balance Sheet, AR/AP aging, and cash position reconcile to posted journal lines,
- management reports do not mix posted and unposted records as if both were actuals,
- every major dashboard number drills to documents or journal lines.

### Likely code areas
- `src/lib/accounting.ts`
- `src/lib/accounting-reports.ts`
- `src/lib/accounting-backfill.ts`
- `src/lib/bank-reconciliation.ts`
- `src/app/accounting/**`
- `src/app/reports/**`
- `src/app/company-accounts/**`
- `src/app/api/accounting/**`
- `src/app/api/company-accounts/**`

---

## 8I. Auth, RBAC, detail policies, audit, notifications

### Objective
Keep the system permission-shaped and audit-safe.

### Strong recommendations
- keep route protection, detail policy, and field masking consistent,
- align dashboard cards with actual permissions,
- do not expose amounts or narratives on workspace cards to roles that should only see totals or counts,
- notifications should route to the actor who can take action,
- approval actions, postings, reversals, and manual overrides must always write audit logs.

### Acceptance criteria
- users never see pages or figures they should not see,
- every approval or financial settlement action has an audit event,
- masked views remain masked on detail drill-down pages and APIs.

### Likely code areas
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- `src/lib/access-control.ts`
- `src/proxy.ts`
- detail-policy libs
- `src/app/notifications/**`
- `src/app/api/notifications/**`
- audit routes and helpers

---

## 9. Cross-module event maps

This is the heart of completion. Codex should design around these flows.

## 9.1 Employee operational spend flow
1. Employee requests advance or spends own pocket.
2. Advance is approved.
3. Advance is paid from company account.
4. Employee submits expense claim.
5. ERP applies relevant advance(s) to expense line(s) or requires justification not to apply them.
6. Approved expense is posted.
7. Remaining balance becomes:
   - reimbursement due to employee, or
   - return due from employee, or
   - no settlement because fully cleared by advance.
8. Reimbursement is paid directly or scheduled into a defined payroll month.
9. Overdue residual advance can be recovered through payroll only by explicit rule.

## 9.2 Monthly payroll flow
1. Attendance/leave conflicts are resolved.
2. Payroll draft is generated for month.
3. Controlled payroll inputs are pulled in:
   - compensation profile,
   - approved variable pay scheduled for month,
   - reimbursements scheduled for payroll,
   - recoveries approved for payroll,
   - attendance/leave effects.
4. Payroll is reviewed and approved.
5. Payroll accrual is posted.
6. Payroll is paid from company account / bank.
7. Payroll Control Register moves entries to paid state with references.

## 9.3 Procurement stock flow
1. Purchase order approved.
2. Goods received.
3. Inventory and GRN clearing impact posted.
4. Vendor bill matched against PO and GRN.
5. AP liability posted.
6. Payment allocated.
7. Reversal available when required.

## 9.4 Project billing and recovery flow
1. Quotation approved.
2. Project created and owned.
3. Operational cost documents accumulate.
4. Invoice issued.
5. Receipt allocated.
6. Project register updates contract, billed, received, receivable, cost, and margin.

## 9.5 Variable pay flow
1. Incentive/commission source created.
2. Approval captures basis and approved amount.
3. Settlement channel determined.
4. For payroll channel: assign payroll month and carry into payroll input.
5. For AP channel: create vendor payable path.
6. For direct channel: pay with company account and capture reference.
7. Register shows settled month and settlement reference.

---

## 10. Data model guidance

### 10.1 Do not multiply truth fields without a rebuild path
If you cache totals or balances for performance, provide:
- the canonical source query,
- a rebuild routine,
- a drift-detection routine.

### 10.2 Suggested structural additions / cleanup
These are guidance patterns. Final naming can vary.

#### Payroll
Add or confirm:
- payroll month / period key on run and entry,
- distinct approved/posted/paid timestamps,
- company account / payment reference on disbursement,
- component line category enum: `BASE`, `ALLOWANCE`, `VARIABLE_PAY`, `REIMBURSEMENT`, `ADVANCE_RECOVERY`, `ATTENDANCE_DEDUCTION`, `OTHER_DEDUCTION`, etc.,
- source linkage from each component line back to incentive/commission/expense/advance source.

#### Incentives / commissions
Add or confirm:
- earning month,
- approved month,
- scheduled payroll month,
- due date if not payroll,
- settlement channel,
- settled month,
- settlement reference,
- reversal reference if any,
- basis snapshot or metadata JSON with rule version.

#### Salary advances
Add or confirm:
- due date,
- intended settlement path,
- issued amount,
- claimed amount,
- returned amount,
- payroll recovered amount,
- open balance,
- linked payment records,
- linked expense applications.

#### Expenses
Add or confirm:
- funding source,
- advance applied amount,
- reimbursement channel,
- reimbursement payroll month,
- reimbursement balance,
- posted timestamp,
- linked project/task.

#### Procurement and inventory
Add or confirm:
- PO/GRN/vendor-bill line linkage,
- matched quantity/value,
- mismatch flags,
- override approvals when tolerances are exceeded,
- reversal references.

### 10.3 Prefer registers/views over duplicate status logic in many pages
A large share of current pain is caused by status interpretation being repeated in multiple pages. Centralize it.

---

## 11. Coding and architecture guidelines for Codex

### 11.1 Keep route handlers thin
API routes should:
- validate input,
- check permission,
- call one domain service,
- return structured result.

They should not contain major business logic branches or GL logic.

### 11.2 Put domain logic in `src/lib/*`
Concentrate event logic in services such as:
- payroll builder / settlement services,
- accounting posting services,
- project financial services,
- reimbursement / advance application services,
- matching services for procurement/AP,
- workspace/register query services.

### 11.3 Use `prisma.$transaction` for multi-record state transitions
Any event that changes more than one source of truth should be transactional.

### 11.4 One idempotent posting layer
Accounting posting should be:
- idempotent,
- reversible,
- source-document aware,
- period-aware.

### 11.5 Standardize enums and status interpretation
Create a shared place for status constants and helper predicates. Do not redefine business meaning in many pages.

### 11.6 Move dashboard math out of UI pages
UI pages should not re-implement control logic ad hoc. Build shared register/query services and reuse them.

### 11.7 Build correction through reversal helpers
For posted documents, build explicit reversal helpers and corresponding tests. Avoid bespoke “undo” logic scattered across routes.

### 11.8 Make month-aware queries first-class
Payroll, variable pay, reimbursements, and due items need stable month/date filtering and aging helpers.

### 11.9 Add explicit reason capture for exceptions
When users bypass matching, reopen payroll, skip applying an advance, or perform manual settlement corrections, require a reason.

### 11.10 Keep mobile critical paths usable
The most frequently used employee and manager flows should remain usable on mobile:
- submit expense,
- view own payroll,
- see due tasks,
- approve/reject simple items,
- review own advance balance.

---

## 12. Recommended workstream order

This order matters. Do not random-walk across the codebase.

## Workstream 0 — Freeze unsafe behavior and normalize control vocabulary

### Goals
- remove any remaining unsafe deletes,
- standardize states/enums,
- ensure audit hooks exist,
- ensure period lock checks are consistently applied.

### Exit criteria
- no approved/posted/paid record can be hard-deleted,
- shared helpers exist for core status interpretation,
- audit exists for all material actions.

---

## Workstream 1 — Employee Settlement Spine

### Goals
Complete the employee-finance truth model before touching payroll again.

### Deliverables
- Employee Settlement Register,
- advance application/return/recovery rules,
- reimbursement states and channels,
- direct reimbursement payment flow,
- payroll-routed reimbursement scheduling.

### Exit criteria
- every employee balance can be explained from documents,
- every expense either clears an advance, creates reimbursement due, or is company-paid,
- open advances and reimbursements are visible by aging.

---

## Workstream 2 — Variable Pay Register

### Goals
Professionalize incentives and employee commissions.

### Deliverables
- unified variable-pay query layer/register,
- earning month + scheduled payroll month logic,
- settlement channel discipline,
- AP integration for third-party commissions,
- payroll input linkage for employee variable pay.

### Exit criteria
- management can answer what was earned, approved, scheduled, and settled by month,
- payroll consumes variable pay as controlled input rather than discovering it ad hoc.

---

## Workstream 3 — Payroll Control Register and payroll lifecycle

### Goals
Convert payroll into a true month-end control process.

### Deliverables
- payroll statuses and month control,
- attendance/leave pre-payroll conflict handling,
- controlled input ingestion,
- accrual vs payment separation,
- disbursement audit and payment references,
- employee payroll history improvements.

### Exit criteria
- payroll can answer due/pending/paid/overdue by month,
- every paid payroll entry has company-account and reference data,
- reopened or reversed payroll events leave a clean audit trail.

---

## Workstream 4 — Procurement, inventory, and AP truth

### Goals
Finish the stock/AP control path.

### Deliverables
- matching controls,
- GRN clearing / stock received not billed behavior,
- mismatch reporting,
- payment allocation discipline,
- stable reversal flows.

### Exit criteria
- procurement/AP register answers ordered/received/billed/paid/outstanding,
- inventory value reconciles to receipt/bill/reversal events.

---

## Workstream 5 — Project financial truth

### Goals
Make project views trustworthy.

### Deliverables
- Project Financial Register,
- commercial vs cost vs cash separation,
- link all major cost sources correctly,
- drift checks between cached summaries and canonical sources if caches remain.

### Exit criteria
- project margin and recovery drill down cleanly,
- management can trust project pages without spreadsheet correction.

---

## Workstream 6 — Role-based workspaces and exception dashboards

### Goals
Turn the ERP into a daily-use operating system.

### Deliverables
- My Workspace,
- Manager Workspace,
- Finance Control Workspace,
- Procurement/Store Workspace,
- HR/Payroll Workspace,
- CEO/Owner Workspace.

### Exit criteria
- each role sees “what requires action now” first,
- all counts drill into filtered actionable lists.

---

## Workstream 7 — Reporting, reconciliation, and close discipline

### Goals
Make reporting dependable.

### Deliverables
- report reconciliation review,
- period-close checklist,
- bank reconciliation exception views,
- AR/AP/payroll/advance aging views,
- export-safe operational reports.

### Exit criteria
- finance can close a period and explain exceptions,
- management reports tie to posted data.

---

## Workstream 8 — Hardening, UAT, migration, export hygiene

### Goals
Make the system safe to ship for controlled production.

### Deliverables
- data repair/backfill scripts,
- migration notes,
- updated documentation,
- test evidence,
- clean export profile with no secrets or irrelevant artifacts.

### Exit criteria
- a fresh export contains code and documentation, not secrets or debug waste,
- the business can run UAT from prepared scripts,
- next audit can verify against explicit acceptance gates.

---

## 13. Detailed acceptance checklist for the next handoff

Codex should not claim completion until the following can be demonstrated.

### 13.1 Payroll and variable pay
- show one employee’s payroll for three different months,
- show which variable pay lines landed in each month,
- show what was paid vs still due,
- show payment account and reference,
- show advance recovery and reimbursement-in-payroll separately.

### 13.2 Employee settlements
- show one advance that was paid, partly claimed, partly returned,
- show one own-pocket expense reimbursed directly,
- show one expense routed through payroll reimbursement,
- show overdue advance visibility.

### 13.3 Procurement/AP
- show one PO -> GRN -> vendor bill -> payment sequence,
- show mismatch behavior when invoice exceeds receipt,
- show reversal of a posted document.

### 13.4 Project financials
- show one project with quotation, expense, procurement, invoice, and receipt,
- prove that project financial numbers drill to documents,
- prove that draft/unposted records do not masquerade as actuals.

### 13.5 Dashboards
- show employee, manager, finance, and CEO workspaces,
- demonstrate that every card drills to underlying items,
- verify permission-shaped visibility.

### 13.6 Accounting and reports
- show how a payroll payment, vendor payment, receipt allocation, and expense reimbursement hit the books,
- show aging and cash position views,
- show period lock behavior.

---

## 14. Test strategy Codex should follow

## 14.1 Unit / domain tests
Cover:
- payroll month selection,
- variable-pay scheduling,
- advance outstanding / claim / return / recovery math,
- reimbursement balance math,
- project financial aggregation,
- matching tolerances,
- reversal behavior.

## 14.2 API integration tests
Cover:
- permission enforcement,
- lifecycle transitions,
- reversal endpoints,
- allocation endpoints,
- invalid cross-module combinations.

## 14.3 End-to-end scenarios
At minimum:
1. employee advance + expense claim + return,
2. own-pocket expense + reimbursement,
3. payroll with attendance penalty + variable pay + advance recovery,
4. employee commission settled through payroll,
5. middleman commission routed through AP,
6. PO -> GRN -> vendor bill -> payment,
7. invoice -> receipt allocation,
8. dashboard drill-down by role,
9. reversal of posted procurement document,
10. period lock and reopen behavior.

## 14.4 UAT packs
Prepare business-friendly scripts for:
- employee,
- project manager,
- finance,
- HR/payroll,
- CEO/owner.

---

## 15. Documentation Codex must deliver with the next codebase

At minimum, the next delivery should include:

1. updated lifecycle diagrams for:
   - expenses,
   - salary advances,
   - payroll,
   - variable pay,
   - procurement/AP,
   - invoice/receipt allocation;
2. a data dictionary for critical statuses and fields;
3. a report dictionary explaining each dashboard/control metric;
4. a migration/backfill note for any changed accounting or settlement semantics;
5. a test evidence summary;
6. an export note confirming no secrets or local artifacts are packaged.

---

## 16. What Codex must not do

Do not:
- start a new large module,
- add more dashboard pages without first fixing the register/query layer,
- keep adding totals in pages without a canonical source,
- mix salary, reimbursement, and wallet semantics,
- auto-settle variable pay just because it was approved,
- auto-recover every advance through payroll by default,
- allow free-floating payments without source allocation,
- hard-delete approved/posted/paid records,
- let project financial pages mix draft and posted facts as if both are actuals,
- hide mismatches instead of surfacing them.

---

## 17. Likely priority file map in the current codebase

Based on the current structure, the highest-impact areas are likely:

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `src/lib/accounting.ts`
- `src/lib/accounting-reports.ts`
- `src/lib/accounting-backfill.ts`
- `src/lib/bank-reconciliation.ts`
- `src/lib/payroll-policy.ts`
- `src/lib/payroll-settlement.ts`
- `src/lib/projects.ts`
- `src/lib/approval-engine.ts`
- `src/lib/validation.ts`
- `src/lib/dashboard.ts`
- `src/lib/access-control.ts`
- `src/lib/permissions.ts`
- `src/app/api/payroll/**`
- `src/app/api/incentives/**`
- `src/app/api/commissions/**`
- `src/app/api/salary-advances/**`
- `src/app/api/expenses/**`
- `src/app/api/procurement/**`
- `src/app/api/invoices/**`
- `src/app/api/income/**`
- `src/app/api/projects/**`
- `src/app/payroll/**`
- `src/app/salary-advances/**`
- `src/app/expenses/**`
- `src/app/procurement/**`
- `src/app/projects/**`
- `src/app/dashboard/**`
- `src/app/me/**`
- `src/app/ceo/dashboard/**`
- `src/app/reports/**`
- components around payroll, salary advance, dashboards, and settlement dialogs.

---

## 18. The single strongest instruction to Codex

**Finish the ERP by building the control spine, not by adding more forms.**

That control spine is:

1. **Employee Settlement Register**  
2. **Variable Pay Register**  
3. **Payroll Control Register**  
4. **Project Financial Register**  
5. **Procurement/AP Register**  
6. **Role-based actionable workspaces**

Once those are correct, the existing modules become manageable, auditable, and trustworthy.

Without them, the same confusion will keep returning in payroll, incentives, reimbursements, advances, dashboards, and project reporting.

---

## 19. Benchmark reference set for Codex

Use these as design references, not as copy-paste implementation templates.

- Odoo Payroll / Work Entries / Payslips / Expense reimbursement
  - https://www.odoo.com/documentation/19.0/applications/hr/payroll/payslips.html
  - https://www.odoo.com/documentation/19.0/applications/hr/payroll/work_entries.html
  - https://www.odoo.com/documentation/19.0/applications/finance/expenses/reimburse.html

- ERPNext / Frappe HR Payroll Entry, Additional Salary, Expense Claim, Employee Advance, Perpetual Inventory
  - https://docs.frappe.io/erpnext/user/manual/en/payroll-entry
  - https://docs.frappe.io/erpnext/v14/user/manual/en/human-resources/additional-salary
  - https://docs.frappe.io/erpnext/user/manual/en/expense-claim
  - https://docs.frappe.io/hr/employee-advance
  - https://docs.frappe.io/erpnext/user/manual/en/perpetual-inventory

- Microsoft Dynamics 365 Finance / Project Operations
  - https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching
  - https://learn.microsoft.com/en-us/dynamics365/project-operations/expense/cash-advance

- Oracle Fusion Expenses
  - https://docs.oracle.com/en/cloud/saas/financials/26a/fawde/using-expenses.pdf

- SAP SuccessFactors Variable Pay
  - https://help.sap.com/docs/successfactors-compensation/implementing-and-managing-variable-pay/validation-reports-in-variable-pay
  - https://help.sap.com/docs/successfactors-compensation/implementing-and-managing-variable-pay/sharing-variable-pay-data-to-employee-central

---

## 20. Final instruction for the next audit

Codex should treat this document as the **authoritative completion contract** for the next implementation cycle.

When the next codebase is ready, the verification question will be simple:

> Did the code complete the control spine described here, or did it only add more UI and partial logic?

That is the standard the next audit should use.
