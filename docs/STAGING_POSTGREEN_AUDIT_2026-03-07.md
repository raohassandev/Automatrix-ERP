# Staging Post-Green Audit (Discrepancy-Only)

Date: 2026-03-07  
Environment: `https://erp-staging.automatrix.pk`  
Gate command: `pnpm qa:staging:postgreen`

## Result Summary

- Effective-permission parity: pass (`17` active users, `0` mismatches)
- RC critical suite: pass (`40/40`)
- Mobile expense submit smoke: pass (`1/1`)
- Vendor/Item/Project workhub RBAC suite (`retries=0`): pass (`10/10`)

## Open Discrepancies

- Critical: `0`
- High: `0`
- Medium: `0`
- Low: `0`

## Remaining Go-Live Blockers (Process/Manual)

1. Owner/CEO final sign-off on Access Control behavior in staging.
2. Production manual mobile smoke sign-off (expense submit + final UX confirmation).
3. Rollback drill execution evidence in staging-like environment.

