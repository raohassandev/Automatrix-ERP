# Staging Deep Role Audit - Discrepancies Only

- Generated: 2026-03-06T07:59:09.778Z
- Scope: Finance Manager (QA) (finance1@automatrix.pk); Engineering (QA) (engineer1@automatrix.pk); Sales (QA) (sales1@automatrix.pk); Store (QA) (store1@automatrix.pk); Technician (QA) (technician1@automatrix.pk)
- Summary: CRITICAL 1, HIGH 0, MEDIUM 0, LOW 0

## Findings

### 1. [CRITICAL] Role audit execution failed
- Role: Finance Manager (QA) (finance1@automatrix.pk)
- Area: RUNTIME
- Route/API: /login
- Expected: Audit should run end-to-end for this role
- Actual: apiRequestContext._wrapApiCall: ENOENT: no such file or directory, open '/Users/israrulhaq/Desktop/DEV/Automatrix-ERP/test-results/.playwright-artifacts-0/traces/27e6b63e14a293f02113-959721061f13506d6f7f.network'
