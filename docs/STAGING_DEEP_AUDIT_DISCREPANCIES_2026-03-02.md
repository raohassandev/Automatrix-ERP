# Staging Deep Audit Report (Discrepancies Only)

- Date: 2026-03-02
- Target: `https://erp-staging.automatrix.pk`
- Scope: role-by-role auth, RBAC routing, API access, sidebar/menu visibility, mobile entry flow
- Roles tested:
  - `israrulhaq5@gmail.com` (Owner)
  - `raoshaziakhalil@gmail.com` (CEO)
  - `raoabdulkhaliq786@gmail.com` (Business Development Manager)
  - `raomazeem1122@gmail.com` (Engineering Technician)
  - `raoibrarulhaq1@gmail.com` (Procurement + Field Ops)
  - `raomubasher5555@gmail.com` (Engineering Manager)
  - `technician1@automatrix.pk` (Staff baseline regression check)

## Critical Findings

### C-01: Custom-role users are trapped in redirect loops after login
- Severity: `CRITICAL`
- Affected roles: Business Development Manager, Engineering Technician, Procurement + Field Ops, Engineering Manager
- Evidence:
  - Credentials callback succeeds and session exists (`/api/auth/session` returns authenticated user).
  - Navigating `/dashboard` and most protected routes yields repeated `307` to `/dashboard?error=forbidden`.
  - Browser ends with `net::ERR_TOO_MANY_REDIRECTS` / `chrome-error://chromewebdata/`.
- Root cause:
  - [src/proxy.ts](/Users/israrulhaq/Desktop/DEV/Automatrix-ERP/src/proxy.ts) checks route access using static `hasPermission(roleName, ...)`.
  - Custom role names are DB-defined and not in static `PERMISSIONS`, so permission checks evaluate false.
  - Fallback redirect target is `/dashboard`, which itself is guarded by the same rule, creating a loop.
- Business impact:
  - Custom-role users effectively cannot use ERP modules despite valid credentials and active employee records.

### C-02: Staff role can access full accounting reports and financial data
- Severity: `CRITICAL`
- Affected role: `Staff` (`technician1@automatrix.pk`)
- Evidence:
  - Sidebar shows accounting report routes for Staff.
  - API calls return `200` with accounting rows:
    - `/api/reports/accounting/trial-balance`
    - `/api/reports/accounting/profit-loss`
    - `/api/reports/accounting/balance-sheet`
- Root cause:
  - `Staff` includes `reports.view_own` in static permissions.
  - Report APIs treat `view_own` as sufficient for full accounting outputs (no own-scope filter for accounting ledgers).
- Business impact:
  - Confidential finance data exposure to low-privilege staff.

## High Findings

### H-01: Forbidden handling path is architecturally broken
- Severity: `HIGH`
- Affected roles: all custom roles without static mapping
- Evidence:
  - Forbidden fallback uses `/dashboard?error=forbidden`.
  - For roles denied `dashboard.view`, fallback route is also denied and loops infinitely.
- Impact:
  - Users see browser-level errors instead of a controlled access-denied screen.

### H-02: Role-based UI and route authorization are not aligned for custom roles
- Severity: `HIGH`
- Affected roles: all custom roles
- Evidence:
  - Session indicates custom role successfully authenticated.
  - Route middleware blocks based on static role map.
  - DB role templates and user overrides do not reliably translate to route-level access in middleware.
- Impact:
  - Admin-configured role templates cannot be trusted in live usage.

### H-03: Access-control UX still exposes non-final behavior as if production-ready
- Severity: `HIGH`
- Evidence in [src/components/AccessControlCenter.tsx](/Users/israrulhaq/Desktop/DEV/Automatrix-ERP/src/components/AccessControlCenter.tsx):
  - Permission editing uses modal-heavy flow for large matrices.
  - `CUSTOM` mode is shown but explicitly mapped to SELF (`// For now, custom behaves as self-scope`).
- Impact:
  - Owners can misconfigure roles believing fine-grain custom scope exists when it does not.

### H-04: Mobile role usage inherits same redirect-loop failure
- Severity: `HIGH`
- Affected roles: custom roles
- Evidence:
  - Post-login mobile route open attempts to `/dashboard` fail with `ERR_TOO_MANY_REDIRECTS`.
- Impact:
  - Mobile users cannot reliably enter role-specific workflows.

## Medium Findings

### M-01: Repeated client runtime errors on authenticated pages
- Severity: `MEDIUM`
- Affected roles: Owner/CEO and others during navigation
- Evidence:
  - Console errors repeatedly include:
    - `Failed to fetch. Read more at https://errors.authjs.dev#autherror`
    - `Error loading categories: TypeError: Failed to fetch`
- Impact:
  - Hidden reliability issues and noisy client runtime state.

### M-02: Report navigation granularity is too coarse
- Severity: `MEDIUM`
- Evidence:
  - Single reports permission bucket exposes many report links.
  - No clear per-report gating model in sidebar for sensitive accounting outputs.
- Impact:
  - High chance of overexposure when assigning any report visibility.

## Immediate Fix Order

1. Fix middleware RBAC to use effective (DB + override) permissions, not static role-name checks.
2. Replace forbidden fallback redirect with dedicated `/forbidden` page (never redirect back to guarded route).
3. Lock accounting report APIs to finance/accounting roles only; remove `reports.view_own` access path for full accounting statements.
4. Implement true `CUSTOM` scope behavior or remove it from UI until implemented.
5. Re-run full role matrix audit after middleware and report-API fixes.

