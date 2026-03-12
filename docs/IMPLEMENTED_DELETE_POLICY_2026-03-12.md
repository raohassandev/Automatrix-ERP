# Implemented Modules Delete/Correction Policy
Date: 2026-03-12
Scope: Implemented modules only

## Policy baseline
1. Posted/paid/approved business records must not be hard-deleted.
2. Correction path should use close/archive/void/reopen/reversal flows.
3. Hard delete is allowed only for early-stage draft/pending records where no downstream dependencies exist.

## Currently hardened (non-destructive enforced)
1. Payroll run delete blocked when any entry is `PAID`.
2. Invoice delete restricted to `DRAFT` only.
3. Project delete blocked when linked operational/financial records exist.
4. Project linked-record destructive delete endpoint blocked.
5. Incentive delete restricted to `PENDING` only.
6. Commission delete restricted to `PENDING` only.
7. Company account delete blocked when transactional references exist (deactivate-first posture).
8. Inventory item delete blocked when stock/history exists.
9. Employee/vendor/department/designation delete converted to deactivate-first when linked history exists.
10. Salary advance delete restricted to `PENDING`.
11. Attendance delete blocked (immutable HR history).

## Draft-delete still allowed (current phase)
1. Procurement documents in `DRAFT` state (`PO/GRN/Vendor Bill/Vendor Payment`) can still be deleted when no posted/downstream lock applies.
2. Pending income/expense can be deleted by allowed roles under existing route guards.

## Planned next hardening
1. Replace remaining draft hard-delete paths with cancel/void where practical.
2. Implement formal reversal flows for posted procurement documents (`GRN`, `Vendor Bill`, `Vendor Payment`).
3. Add explicit UI copy on draft-only delete buttons: "Draft delete only (pre-posting)."
