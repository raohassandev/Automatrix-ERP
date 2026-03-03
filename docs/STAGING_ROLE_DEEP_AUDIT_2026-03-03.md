# Staging Deep Role Audit - Discrepancies Only

- Generated: 2026-03-03T21:26:42.433Z
- Scope: Finance Manager (QA) (finance1@automatrix.pk); Engineering (QA) (engineer1@automatrix.pk); Sales (QA) (sales1@automatrix.pk); Store (QA) (store1@automatrix.pk); Technician (QA) (technician1@automatrix.pk)
- Summary: CRITICAL 5, HIGH 4, MEDIUM 0, LOW 0

## Findings

### 1. [CRITICAL] Restricted route is accessible
- Role: Engineering (QA) (engineer1@automatrix.pk)
- Area: RBAC
- Route/API: /reports
- Expected: Role should be blocked on this route
- Actual: Route loaded without forbidden state (URL: https://erp-staging.automatrix.pk/reports)

### 2. [CRITICAL] Restricted route is accessible
- Role: Store (QA) (store1@automatrix.pk)
- Area: RBAC
- Route/API: /reports
- Expected: Role should be blocked on this route
- Actual: Route loaded without forbidden state (URL: https://erp-staging.automatrix.pk/reports)

### 3. [CRITICAL] Restricted route is accessible
- Role: Technician (QA) (technician1@automatrix.pk)
- Area: RBAC
- Route/API: /inventory
- Expected: Role should be blocked on this route
- Actual: Route loaded without forbidden state (URL: https://erp-staging.automatrix.pk/inventory)

### 4. [CRITICAL] Restricted route is accessible
- Role: Technician (QA) (technician1@automatrix.pk)
- Area: RBAC
- Route/API: /reports
- Expected: Role should be blocked on this route
- Actual: Route loaded without forbidden state (URL: https://erp-staging.automatrix.pk/reports)

### 5. [CRITICAL] Restricted API endpoint is accessible
- Role: Technician (QA) (technician1@automatrix.pk)
- Area: RBAC
- Route/API: /api/inventory
- Expected: API should return 403/401 or equivalent denial
- Actual: HTTP 200

### 6. [HIGH] Required access is blocked
- Role: Engineering (QA) (engineer1@automatrix.pk)
- Area: ACCESS
- Route/API: /me
- Expected: Role should access this route
- Actual: Route displays forbidden/access-denied state

### 7. [HIGH] Mobile audit execution failed
- Role: Engineering (QA) (engineer1@automatrix.pk)
- Area: MOBILE
- Route/API: /dashboard
- Expected: Mobile navigation/layout checks should complete
- Actual: page.goto: Timeout 8000ms exceeded.
Call log:
  - navigating to "https://erp-staging.automatrix.pk/projects", waiting until "domcontentloaded"


### 8. [HIGH] Required access is blocked
- Role: Sales (QA) (sales1@automatrix.pk)
- Area: ACCESS
- Route/API: /me
- Expected: Role should access this route
- Actual: Route displays forbidden/access-denied state

### 9. [HIGH] Mobile audit execution failed
- Role: Store (QA) (store1@automatrix.pk)
- Area: MOBILE
- Route/API: /dashboard
- Expected: Mobile navigation/layout checks should complete
- Actual: page.goto: Timeout 8000ms exceeded.
Call log:
  - navigating to "https://erp-staging.automatrix.pk/expenses", waiting until "domcontentloaded"

