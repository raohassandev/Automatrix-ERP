# Staging Deep Role Audit - Discrepancies Only

- Generated: 2026-03-02T21:58:24.044Z
- Scope: Owner (israrulhaq5@gmail.com); CEO (raoshaziakhalil@gmail.com); Business Development Manager (raoabdulkhaliq786@gmail.com); Engineering Technician (raomazeem1122@gmail.com); Procurement + Field Ops (raoibrarulhaq1@gmail.com); Engineering Manager (raomubasher5555@gmail.com)
- Summary: CRITICAL 2, HIGH 0, MEDIUM 12, LOW 0

## Findings

### 1. [CRITICAL] Restricted route is accessible
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: RBAC
- Route/API: /employees
- Expected: Role should be blocked on this route
- Actual: Route loaded without forbidden state (URL: https://erp-staging.automatrix.pk/employees)

### 2. [CRITICAL] Restricted route is accessible
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: RBAC
- Route/API: /employees
- Expected: Role should be blocked on this route
- Actual: Route loaded without forbidden state (URL: https://erp-staging.automatrix.pk/employees)

### 3. [MEDIUM] Console or page errors detected
- Role: Owner (israrulhaq5@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 4. [MEDIUM] Console or page errors detected
- Role: Owner (israrulhaq5@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 5. [MEDIUM] Console or page errors detected
- Role: CEO (raoshaziakhalil@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 6. [MEDIUM] Console or page errors detected
- Role: CEO (raoshaziakhalil@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 7. [MEDIUM] Console or page errors detected
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 8. [MEDIUM] Console or page errors detected
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 9. [MEDIUM] Console or page errors detected
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: RUNTIME
- Route/API: /payroll
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch

### 10. [MEDIUM] Console or page errors detected
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 11. [MEDIUM] Console or page errors detected
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 12. [MEDIUM] Console or page errors detected
- Role: Procurement + Field Ops (raoibrarulhaq1@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 13. [MEDIUM] Console or page errors detected
- Role: Procurement + Field Ops (raoibrarulhaq1@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 14. [MEDIUM] Console or page errors detected
- Role: Engineering Manager (raomubasher5555@gmail.com)
- Area: RUNTIME
- Route/API: /dashboard
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)
