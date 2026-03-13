# Master Completion Execution Tracker (Implemented Modules)

Date started: 2026-03-12  
Source contract: `automatrix_erp_master_completion_plan_2026-03-12.md`

## Parallel Streams

- `Stream A` Control Registers + query layer
- `Stream B` Lifecycle engines (settlement/payroll/procurement correction)
- `Stream C` Role workspaces + actionable dashboards
- `Stream D` Shared validation/status/policy guards
- `Stream E` Test evidence + discrepancy burn-down

## Sprint Blocks

### Block 1 (Foundation) — In progress

- [x] Added shared lifecycle/status helper layer  
  Evidence: `src/lib/lifecycle.ts`, `src/lib/__tests__/lifecycle.test.ts`
- [x] Added control-register query layer skeleton (read-first contract)  
  Evidence: `src/lib/control-registers.ts`
- [x] Added summary API endpoint for control-register snapshot  
  Evidence: `src/app/api/reports/control-registers/summary/route.ts`
- [~] Wire register rows into role workspaces (My / Manager / Finance / CEO)
  - [x] Dashboard (`/dashboard`) control register snapshot cards
  - [x] CEO Dashboard (`/ceo/dashboard`) control register snapshot cards
  - [x] Manager workspace queue block added on dashboard
  - [x] Finance workspace queue block added on dashboard
  - [x] My workspace action queue block added on `/me`
- [x] Add field-level permission masking in register responses where required
  - `maskControlRegistersSummary(...)` used in `/api/reports/control-registers/summary`
  - Controls report (`/reports/controls`) now renders masked view for restricted viewers
- [x] Add focused tests for register math and month-boundary behavior
  - `src/lib/__tests__/payroll-policy.test.ts`
  - `src/lib/__tests__/payroll-settlement.test.ts`

### Block 2 (Employee Settlement + Variable Pay + Payroll control) — In progress

- [x] Employee Settlement Register maturity (advance/reimbursement/payroll due with monthly trace)
  - [x] Include current-month due logic for payroll-linked variable pay (`scheduledPayrollMonth <= current month` for due view)
  - [x] Add explicit month drilldowns on employee settlement pages
    - Payroll queue now separates due-now vs future-scheduled incentive signals
    - `/incentives` supports month/payout/settlement/status/employee filters for direct drilldown
    - `/me` links directly to month-scoped employee incentive due queue
- [x] Variable Pay Register month-aware scheduling/settlement references
- [x] Payroll Control Register full lifecycle and overdue logic hardening

### Block 3 (Procurement/AP + Project truth)

- [x] Procurement/AP register (ordered/received/billed/paid/outstanding by vendor/project)
- [x] Project Financial Register drill-down parity checks (committed vs posted vs cash)
  - Controls report now shows committed vs posted cost vs settled cash outflow per project

### Block 4 (Role workspaces + exception dashboards)

- [~] My Workspace action queues
- [~] Manager Workspace delays/approvals exceptions
- [~] Finance Workspace due/reconciliation/period-close queues
- [~] CEO Workspace cash, recovery, bottleneck exception queues

### Block 5 (Hardening + UAT + Go/No-Go)

- [ ] Deep staging role-by-role audit rerun
- [ ] Discrepancy-only closure report
- [ ] Production cutover checklist sign-off

## Gate Criteria Per Batch

- `pnpm typecheck`
- `pnpm vitest run ...` (targeted + changed areas)
- `pnpm build`
- staging Playwright critical subset for affected flows
