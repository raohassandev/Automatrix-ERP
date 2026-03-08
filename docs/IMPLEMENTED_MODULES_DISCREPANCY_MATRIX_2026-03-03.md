# Implemented Modules Discrepancy Matrix

Date: 2026-03-08
Scope: Implemented modules only

## Summary

- Critical open: 0
- High open: 0
- Medium open: 1
- Low open: 0

## Matrix

| Severity | Module | Area | Discrepancy | Evidence | Status | Owner |
|---|---|---|---|---|---|---|
| Medium | Projects / Finance | Legacy data reconciliation | Project `PV-89` has `receivedAmount` snapshot (`963,082`) but no linked approved income rows by `Income.project`. | `docs/STAGING_READINESS_AUDIT_2026-03-08.md` | Open (Owner decision needed) | Engineering + Owner |

## Closure Rules

- No open critical/high before production cutover.
- Every resolved item requires: code/test proof + audit report reference.
- Deferred items require owner + target date.
