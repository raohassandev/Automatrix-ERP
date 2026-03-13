# Implemented Modules Live TODO Tracker

Date initialized: 2026-03-06  
Scope: Implemented modules only (`1,2,3,6,7,8,10,11,12,13,14,15,16,17,18`)

This file is the running action list for closure, hardening, and go-live readiness.

## 1) Go-Live Blockers (Must close)

- [ ] Owner/CEO final sign-off on staging access-control behavior (role templates + per-user overrides + approval routes).
- [ ] Production manual smoke (mobile):
  - [ ] Expense submit flow on phone width.
  - [x] Staging automated mobile expense submit smoke is passing.  
    Evidence (2026-03-07): `playwright/tests/mobile-expense-submit-smoke.spec.ts`
  - [x] Approvals action controls visible/clickable on phone + tablet widths.  
    Evidence (2026-03-06): `playwright/tests/dashboard-approvals-mobile-smoke.spec.ts`
  - [x] No blocking horizontal clipping on key pages (`/settings`, `/inventory`, `/approvals`, `/expenses`).  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts` finance UX route sweep
- [x] Rollback drill execution in staging-like environment using `docs/PRODUCTION_ROLLBACK_RUNBOOK_2026-03-05.md` (not only documented, actually executed).  
  Evidence (2026-03-08): `MODE=execute ./scripts/rollback-drill-staging.sh` completed rollback (`9899f69 -> 5593d6a`) and roll-forward (`5593d6a -> 9899f69`) with health checks; log: `docs/ROLLBACK_DRILL_LOG_20260308-134627.txt`.

## 2) Security / RBAC Closure

- [x] Final long-tail RBAC parity sweep for implemented modules:
  - [x] Sidebar/mobile links hidden when unauthorized.  
    Evidence (2026-03-06): `playwright/tests/role-deep-audit.spec.ts`, `playwright/tests/mobile-role-navigation.spec.ts`
  - [x] Route + API permission parity for each visible action.  
    Evidence (2026-03-06): `playwright/tests/project-detail-rbac.spec.ts`, `playwright/tests/project-workhub-actions.spec.ts`, `playwright/tests/vendor-item-workhub-actions.spec.ts`, `playwright/tests/inventory-rbac-actions.spec.ts`
  - [x] Remove remaining permissive fallback blocks called out in `docs/RBAC_PERMISSION_SURFACE_MAP_2026-03-03.md`.  
    Evidence (2026-03-06): vendor workhub actions now server-policy driven (`src/lib/vendor-detail-policy.ts`), and legacy unused static-role fallback files removed (`src/lib/vendor-workhub-policy.ts`, `src/lib/project-workhub-policy.ts`, `src/lib/item-workhub-policy.ts`).
- [x] Role data drift check:
  - [x] Re-save/sync role templates on staging.  
    Evidence (2026-03-07): executed `POST /api/access-control/roles/sync` on `https://erp-staging.automatrix.pk`, response `changedCount: 14`.
  - [x] Confirm effective permissions match expected defaults for all active users.  
    Evidence (2026-03-07): `pnpm verify:staging:effective-permissions` -> `noOverrideMismatchCount: 0` across 17 active users.

## 3) Expense & Reimbursement Hardening (Current pass follow-up)

- [x] Run role-by-role UAT for new `EMPLOYEE_POCKET` flow:
  - [x] Employee with advance available cannot submit own-pocket.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Employee with zero advance can submit own-pocket.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Approval creates payable state (`APPROVED/PARTIALLY_APPROVED`), then settlement to `PAID`.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Wallet-funded expenses cannot be paid again (double-pay prevention).  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
- [x] UAT for mistaken-approval reopen:
  - [x] Only `expenses.reopen_approved` users can reopen.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Reopened expense returns to pending and becomes editable by submitter.  
    Evidence (2026-03-06): status reset verified in `playwright/tests/staging-deep-audit.spec.ts` (`^PENDING_`)

## 3.1) Payroll Integrity + Clarity Hardening (2026-03-10)

- [x] Prevent future incentive leakage into old payroll approvals:
  - [x] Policy preview now only includes approved unsettled payroll variable pay up to payroll period end.
  - [x] Payroll approval settlement now only picks variable pay rows created up to payroll period end.
- [x] Payroll run entry integrity:
  - [x] Duplicate employee rows blocked on create/update.
  - [x] Unknown employee IDs blocked on create/update.
- [x] Payroll operator clarity upgrade:
  - [x] Added payroll incentive queue (employee/project/amount/status/aging) on payroll page.
  - [x] Enhanced latest-run variable component breakdown with project-linked line visibility.
  - [x] Added ERP guide link from payroll and introduced `/help#payroll-flow`.
- [x] Task module smoke stabilization:
  - [x] `playwright/tests/tasks-module-smoke.spec.ts` now asserts recurring-template controls based on effective permissions, not static role assumptions.

## 4) Reporting / Reconciliation Confidence

- [x] Full role deep audit run after latest deploy (`playwright/tests/role-deep-audit.spec.ts`) and discrepancy-only report refresh.  
  Evidence (2026-03-06): `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md`, `playwright/tests/role-deep-audit.spec.ts`
- [x] Final cross-module reconciliation pass (staging) for:
  - [x] Project received/pending vs income entries.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts` (`Cross-module reconciliation` case)
  - [x] Project cost vs approved/paid expenses.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] AP aging vs vendor bill/payment allocations.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Employee wallet/advance/reimbursement consistency.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`, `playwright/tests/payroll-deep-audit.spec.ts`, `playwright/tests/procurement-inventory-controls.spec.ts`
- [x] Legacy snapshot reconciliation exception review:
  - [x] `PV-89` exception closed in current staging baseline; project financial verifier now reports zero drift/unresolved refs.  
    Evidence (2026-03-13): `pnpm verify:projects:financial-consistency` -> `driftCount: 0`, `unresolvedRefs.incomeCount: 0`, `unresolvedRefs.expenseCount: 0`.

## 5) Planning Hygiene

- [x] Master completion execution tracker created for concurrent stream management.  
  Evidence (2026-03-12): `docs/MASTER_COMPLETION_EXECUTION_TRACKER_2026-03-12.md`
- [ ] Keep this tracker updated after each batch:
  - [x] mark completed items with date + evidence doc/spec.
  - [x] add new findings immediately with severity and owner.  
    Evidence (2026-03-09): `qa:staging:postgreen` rerun green after smoke/auth test hardening; discrepancy-only report refreshed in `docs/STAGING_POSTGREEN_AUDIT_2026-03-09.md`.
- [ ] Keep module `19` and `20` work out of this file (tracked in `SUPER_MASTER_PLAN.md` main roadmap).

## 7) Latest Operations Evidence (2026-03-09)

- [x] Effective permission parity check rerun: `pnpm verify:staging:effective-permissions` => `0` mismatches on `17` active users.
- [x] Deep staging suites rerun green:
  - `playwright/tests/role-deep-audit.spec.ts`
  - `playwright/tests/staging-deep-audit.spec.ts`
- [x] Staging test-artifact cleanup rerun + verified:
  - dry run log: `docs/STAGING_TEST_ARTIFACT_CLEANUP_20260309-094912.txt`
  - execute log: `docs/STAGING_TEST_ARTIFACT_CLEANUP_20260309-100124.txt`

## 6) HR Profile + Task Performance (Planned Next)

- [x] Architecture decision locked (2026-03-07):
  - Task Management will be a **separate module** integrated with HRMS.
  - Task module = execution engine; HRMS = profile/performance consumer.
  - Rationale: cross-functional operations scope, cleaner RBAC, better scale.

- [~] Task module foundation execution (2026-03-10):
  - [x] New `/tasks` workspace shipped (tasks lane + recurring templates lane).
  - [x] Recurring template model + run endpoint delivered (`TaskTemplate`, `POST /api/tasks/recurrence/run`).
  - [x] Project task review metadata delivered (`reviewScore/reviewNotes/reviewedBy/reviewedAt`).
  - [x] Permission set baseline wired in code and nav:
    - `tasks.view_all`
    - `tasks.view_assigned`
    - `tasks.manage`
    - `tasks.update_assigned`
    - `tasks.review`
    - `tasks.templates_manage`
  - [x] Project execution UI controls now permission-aware for task create/update paths.
  - [x] Staging role-by-role UAT evidence run and discrepancy burn-down for new task workspace.  
    Evidence (2026-03-13): `playwright/tests/tasks-module-smoke.spec.ts` (finance templates access allowed, engineer template management controls blocked), plus postgreen gate coverage in `playwright/tests/vendor-item-workhub-actions.spec.ts` and `playwright/tests/mobile-role-navigation.spec.ts`.

- [ ] Define and implement **Simple Employee Profile v1** (self-service first):
  - [x] Personal/profile basics (name, role, manager, join date, service period).  
    Evidence (2026-03-13): profile snapshot section added in `/me` with employee ID label, reporting line, service-period calculation, department/designation, and employment status.
  - [x] HR summary (attendance, leave balances/requests, payroll snapshot, wallet snapshot).  
    Evidence (2026-03-13): `/me` sections already wired and validated with profile snapshot rollout (`Wallet Snapshot`, `Advance/Reimbursement`, `Attendance Snapshot`, salary/incentive/advance histories).
  - [x] Achievements placeholder section (manual/admin entries in v1).  
    Evidence (2026-03-13): `Achievements (Profile v1)` placeholder block added in `/me`.
  - [ ] Role-based visibility matrix:
    - [x] employee sees self  
      Evidence (2026-03-13): `/employees/[id]` self-access preserved with `employees.view_own`.
    - [x] immediate manager sees direct reports  
      Evidence (2026-03-13): `/employees` and `/employees/[id]` now enforce team scope using `reportingOfficerId` + `employees.view_team`.
    - [x] CEO/Owner sees all  
      Evidence (2026-03-13): full list/detail access remains under `employees.view_all`.
    - client-facing view is separate and explicitly controlled

- [ ] Define and implement **Task Assignment + Completion Performance v1**:
  - [ ] Task authoring foundation:
    - rich text description editor
    - checklist/subtasks
    - evidence attachments/links
    - acceptance criteria section
  - [ ] Assignment model:
    - multiple assignees
    - primary owner + contributors
    - due date + priority + estimate
  - [ ] Task status lifecycle:
    - `TODO -> IN_PROGRESS -> BLOCKED -> DONE -> VERIFIED -> CLOSED`
    - blocked reason mandatory
  - [ ] Owner/manager dashboards: task assignment/completion charts by employee/team.
  - [ ] Employee dashboard: own assigned/completed/overdue tasks trend.
  - [ ] Overdue attention controls:
    - due-date SLA monitoring
    - assignee alerts (in-app + email; mobile push-ready event model)
    - manager/CEO escalation alerts based on threshold
  - [ ] Completion verification & grading:
    - verifier = immediate manager by default
    - CEO/Owner override allowed by permission
    - grading dimensions (interest/effort/capability/learning/lag/improvement need)
    - grading visibility controlled by role policy
  - [ ] Fairness and anti-bias controls:
    - low-rating evidence note required
    - calibration review path (manager + skip-level/HR/CEO permission)
    - audit trail for score edits and reviewer comments

- [ ] Add new permission set for performance workflow before implementation:
  - [x] Baseline keys implemented in current phase:
    - `tasks.view_all`
    - `tasks.view_assigned`
    - `tasks.manage`
    - `tasks.update_assigned`
    - `tasks.review`
    - `tasks.templates_manage`
  - [ ] Next maturity permission keys (phase-2 of task program):
    - `tasks.assign`
    - `tasks.view_team`
    - `tasks.view_company`
    - `tasks.verify`
    - `tasks.close`
    - `tasks.reopen`
    - `tasks.attach_evidence`
    - `tasks.verify_completion`
    - `tasks.grade_completion`
    - `tasks.view_team_performance`
    - `tasks.view_company_performance`

- [ ] Keep this feature set in planned state until current go-live blockers (section 1) are closed.
