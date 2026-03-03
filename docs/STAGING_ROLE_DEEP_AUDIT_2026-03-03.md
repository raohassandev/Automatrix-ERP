# Staging Deep Role Audit - Discrepancies Only

- Generated: 2026-03-03T21:42:28.882Z
- Scope: Finance Manager (QA) (finance1@automatrix.pk); Engineering (QA) (engineer1@automatrix.pk); Sales (QA) (sales1@automatrix.pk); Store (QA) (store1@automatrix.pk); Technician (QA) (technician1@automatrix.pk)
- Summary: CRITICAL 5, HIGH 0, MEDIUM 0, LOW 0

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
