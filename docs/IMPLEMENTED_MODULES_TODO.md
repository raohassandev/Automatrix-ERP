# Implemented Modules Live TODO Tracker

Date initialized: 2026-03-06  
Scope: Implemented modules only (`1,2,3,6,7,8,10,11,12,13,14,15,16,17,18`)

This file is the running action list for closure, hardening, and go-live readiness.

## 1) Go-Live Blockers (Must close)

- [ ] Owner/CEO final sign-off on staging access-control behavior (role templates + per-user overrides + approval routes).
- [ ] Production manual smoke (mobile):
  - [ ] Expense submit flow on phone width.
  - [x] Approvals action controls visible/clickable on phone + tablet widths.  
    Evidence (2026-03-06): `playwright/tests/dashboard-approvals-mobile-smoke.spec.ts`
  - [x] No blocking horizontal clipping on key pages (`/settings`, `/inventory`, `/approvals`, `/expenses`).  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts` finance UX route sweep
- [ ] Rollback drill execution in staging-like environment using `docs/PRODUCTION_ROLLBACK_RUNBOOK_2026-03-05.md` (not only documented, actually executed).

## 2) Security / RBAC Closure

- [ ] Final long-tail RBAC parity sweep for implemented modules:
  - [x] Sidebar/mobile links hidden when unauthorized.  
    Evidence (2026-03-06): `playwright/tests/role-deep-audit.spec.ts`, `playwright/tests/mobile-role-navigation.spec.ts`
  - [x] Route + API permission parity for each visible action.  
    Evidence (2026-03-06): `playwright/tests/project-detail-rbac.spec.ts`, `playwright/tests/project-workhub-actions.spec.ts`, `playwright/tests/vendor-item-workhub-actions.spec.ts`, `playwright/tests/inventory-rbac-actions.spec.ts`
  - [x] Remove remaining permissive fallback blocks called out in `docs/RBAC_PERMISSION_SURFACE_MAP_2026-03-03.md`.  
    Evidence (2026-03-06): vendor workhub actions now server-policy driven (`src/lib/vendor-detail-policy.ts`), and legacy unused static-role fallback files removed (`src/lib/vendor-workhub-policy.ts`, `src/lib/project-workhub-policy.ts`, `src/lib/item-workhub-policy.ts`).
- [ ] Role data drift check:
  - [ ] Re-save/sync role templates on staging.  
    Implemented (2026-03-06): `POST /api/access-control/roles/sync` + Settings UI button `Sync Baseline Roles` in Access Control Center.
  - [ ] Confirm effective permissions match expected defaults for all active users.

## 3) Expense & Reimbursement Hardening (Current pass follow-up)

- [ ] Run role-by-role UAT for new `EMPLOYEE_POCKET` flow:
  - [x] Employee with advance available cannot submit own-pocket.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Employee with zero advance can submit own-pocket.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Approval creates payable state (`APPROVED/PARTIALLY_APPROVED`), then settlement to `PAID`.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Wallet-funded expenses cannot be paid again (double-pay prevention).  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
- [ ] UAT for mistaken-approval reopen:
  - [x] Only `expenses.reopen_approved` users can reopen.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Reopened expense returns to pending and becomes editable by submitter.  
    Evidence (2026-03-06): status reset verified in `playwright/tests/staging-deep-audit.spec.ts` (`^PENDING_`)

## 4) Reporting / Reconciliation Confidence

- [x] Full role deep audit run after latest deploy (`playwright/tests/role-deep-audit.spec.ts`) and discrepancy-only report refresh.  
  Evidence (2026-03-06): `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md`, `playwright/tests/role-deep-audit.spec.ts`
- [ ] Final cross-module reconciliation pass (staging) for:
  - [x] Project received/pending vs income entries.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts` (`Cross-module reconciliation` case)
  - [x] Project cost vs approved/paid expenses.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] AP aging vs vendor bill/payment allocations.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`
  - [x] Employee wallet/advance/reimbursement consistency.  
    Evidence (2026-03-06): `playwright/tests/staging-deep-audit.spec.ts`, `playwright/tests/payroll-deep-audit.spec.ts`, `playwright/tests/procurement-inventory-controls.spec.ts`

## 5) Planning Hygiene

- [ ] Keep this tracker updated after each batch:
  - [ ] mark completed items with date + evidence doc/spec.
  - [ ] add new findings immediately with severity and owner.
- [ ] Keep module `19` and `20` work out of this file (tracked in `SUPER_MASTER_PLAN.md` main roadmap).

## 6) HR Profile + Task Performance (Planned Next)

- [ ] Define and implement **Simple Employee Profile v1** (self-service first):
  - [ ] Personal/profile basics (name, role, manager, join date, service period).
  - [ ] HR summary (attendance, leave balances/requests, payroll snapshot, wallet snapshot).
  - [ ] Achievements placeholder section (manual/admin entries in v1).
  - [ ] Role-based visibility matrix:
    - employee sees self
    - immediate manager sees direct reports
    - CEO/Owner sees all
    - client-facing view is separate and explicitly controlled

- [ ] Define and implement **Task Assignment + Completion Performance v1**:
  - [ ] Owner/manager dashboards: task assignment/completion charts by employee/team.
  - [ ] Employee dashboard: own assigned/completed/overdue tasks trend.
  - [ ] Overdue attention controls:
    - due-date SLA monitoring
    - assignee alerts
    - manager/CEO escalation alerts based on threshold
  - [ ] Completion verification & grading:
    - verifier = immediate manager by default
    - CEO/Owner override allowed by permission
    - grading dimensions (interest/effort/capability/learning/lag/improvement need)
    - grading visibility controlled by role policy

- [ ] Add new permission set for performance workflow before implementation:
  - [ ] `tasks.verify_completion`
  - [ ] `tasks.grade_completion`
  - [ ] `tasks.view_team_performance`
  - [ ] `tasks.view_company_performance`

- [ ] Keep this feature set in planned state until current go-live blockers (section 1) are closed.
