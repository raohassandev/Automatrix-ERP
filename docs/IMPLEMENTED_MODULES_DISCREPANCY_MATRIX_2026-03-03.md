# Implemented Modules Discrepancy Matrix

Date: 2026-03-03
Scope: Implemented modules only

## Summary

- Critical open: 5
- High open: 4
- Medium open: 0
- Low open: 0

## Matrix

| Severity | Module | Area | Discrepancy | Evidence | Status | Owner |
|---|---|---|---|---|---|---|
| CRITICAL | RBAC | Routes | Engineering role can access `/reports` while expected restricted for operator profile | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (policy decision + deploy pending) | Engineering |
| CRITICAL | RBAC | Routes | Store role can access `/reports` while expected restricted for operator profile | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (policy decision + deploy pending) | Engineering |
| CRITICAL | RBAC | Routes | Technician role can access `/inventory` though operator profile expects no inventory master access | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (permission baseline patched in code; deploy pending) | Engineering |
| CRITICAL | RBAC | Routes | Technician role can access `/reports` while expected restricted | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (permission baseline patched in code; deploy pending) | Engineering |
| CRITICAL | RBAC | API | Technician can call `/api/inventory` (HTTP 200) but profile expects denial | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (permission baseline patched in code; deploy pending) | Engineering |
| HIGH | Access | My Portal | Engineering QA user blocked from `/me` but role intent expects own portal | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (permission baseline patched in code; deploy pending) | Engineering |
| HIGH | Access | My Portal | Sales QA user blocked from `/me` but role intent expects own portal | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (permission baseline patched in code; deploy pending) | Engineering |
| HIGH | Mobile Audit | Stability | Mobile deep-audit occasionally times out on route transitions | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (timeouts tuned; monitor after deploy) | Engineering/DevOps |
| HIGH | Mobile Audit | Stability | Store QA mobile pass had intermittent timeout at `/expenses` navigation | `docs/STAGING_ROLE_DEEP_AUDIT_2026-03-03.md` | Open (timeouts tuned; monitor after deploy) | Engineering/DevOps |

## Closure Rules

- No open critical/high before production cutover.
- Every resolved item requires: code/test proof + audit report reference.
- Deferred items require owner + target date.
