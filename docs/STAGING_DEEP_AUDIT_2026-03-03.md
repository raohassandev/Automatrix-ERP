# Staging Deep Audit Report (2026-03-03)

## Scope
- Environment: `https://erp-staging.automatrix.pk`
- Focus: completed modules readiness, RBAC, navigation visibility, mobile usability, cross-module posting effects
- Tooling: Playwright (`playwright.config.staging.ts`)

## What Was Executed
1. `playwright/tests/item-detail-and-me-portal.spec.ts`
2. `playwright/tests/mobile-owner-critical-layout.spec.ts`
3. `playwright/tests/procurement-inventory-controls.spec.ts`
4. `playwright/tests/project-ae-pv-regression.spec.ts`
5. `playwright/tests/project-financial-overview.spec.ts`
6. `playwright/tests/staging-deep-audit.spec.ts`

## Results Snapshot
- Passed: 11 tests
- Failed: 1 test (staging-deep-audit finance smoke, console/page error assertion)
- Skipped: 0 in latest rerun

## Confirmed Fixes Applied During Audit
1. Sidebar permission mismatch fixed
- Report links now require report permissions that match page guards.
- Commit: `7e6093c`

2. Mobile navigation restored
- Mobile top bar now mounts `MobileMenu` so users can navigate all allowed modules.
- Commit: `e4d8c29`

3. Role permission UX improved
- Professional role modal with module navigation/search and yes/no/self/custom controls.
- Commit: `0764348`

4. Playwright staging login stability improved
- Auth helper now targets credentials panel reliably.
- Commit: `2b4ec50`

## Outstanding Issue (P1)
1. Runtime console/page error on inventory ledger
- Symptom: Minified React error `#418` during finance smoke
- Route identified: `/inventory/ledger`
- Root cause: hydration mismatch on date rendering in ledger client
- Code fix already implemented in repo: stable date rendering in `LedgerClient`
- Commit: `2b4ec50`
- Current status: fix committed; staging run still showed the error before this latest commit was deployed

## Role/Permission Standardization Completed
Custom role templates standardized on staging DB:
1. `Business Development Manager`
2. `Engineering Technician`
3. `Procurement + Field Ops`
4. `Engineering Manager`

Emails assigned and verified:
1. `israrulhaq5@gmail.com` => `Owner`
2. `raoshaziakhalil@gmail.com` => `CEO`
3. `raoabdulkhaliq786@gmail.com` => `Business Development Manager`
4. `raomazeem1122@gmail.com` => `Engineering Technician`
5. `raoibrarulhaq1@gmail.com` => `Procurement + Field Ops`
6. `raomubasher5555@gmail.com` => `Engineering Manager`

## Release Readiness
- Status: **Near-ready, pending one verification pass after latest deploy**
- Blocker: confirm React #418 no longer appears after commit `2b4ec50` is live on staging

## Immediate Next Verification
1. Wait for deploy of latest commits (`e4d8c29`, `2b4ec50`)
2. Re-run:
- `playwright/tests/staging-deep-audit.spec.ts`
- `playwright/tests/mobile-owner-critical-layout.spec.ts`
3. If clean: staging is ready for owner/user acceptance testing
