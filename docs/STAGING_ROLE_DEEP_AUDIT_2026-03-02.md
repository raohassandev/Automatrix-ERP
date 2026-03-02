# Staging Deep Role Audit - Discrepancies Only

- Generated: 2026-03-02T22:07:04.115Z
- Scope: Owner (israrulhaq5@gmail.com); CEO (raoshaziakhalil@gmail.com); Business Development Manager (raoabdulkhaliq786@gmail.com); Engineering Technician (raomazeem1122@gmail.com); Procurement + Field Ops (raoibrarulhaq1@gmail.com); Engineering Manager (raomubasher5555@gmail.com)
- Summary: CRITICAL 0, HIGH 4, MEDIUM 13, LOW 0

## Findings

### 1. [HIGH] Sidebar exposes link to forbidden page
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: UX
- Route/API: /employees
- Expected: Forbidden features should be hidden from sidebar
- Actual: Sidebar link visible, but route shows access denied

### 2. [HIGH] Sidebar exposes link to forbidden page
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: UX
- Route/API: /employees
- Expected: Forbidden features should be hidden from sidebar
- Actual: Sidebar link visible, but route shows access denied

### 3. [HIGH] Sidebar exposes link to forbidden page
- Role: Procurement + Field Ops (raoibrarulhaq1@gmail.com)
- Area: UX
- Route/API: /employees
- Expected: Forbidden features should be hidden from sidebar
- Actual: Sidebar link visible, but route shows access denied

### 4. [HIGH] Sidebar exposes link to forbidden page
- Role: Engineering Manager (raomubasher5555@gmail.com)
- Area: UX
- Route/API: /employees
- Expected: Forbidden features should be hidden from sidebar
- Actual: Sidebar link visible, but route shows access denied

### 5. [MEDIUM] Console or page errors detected
- Role: Owner (israrulhaq5@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 6. [MEDIUM] Console or page errors detected
- Role: Owner (israrulhaq5@gmail.com)
- Area: RUNTIME
- Route/API: /approvals
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 7. [MEDIUM] Console or page errors detected
- Role: CEO (raoshaziakhalil@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 8. [MEDIUM] Console or page errors detected
- Role: CEO (raoshaziakhalil@gmail.com)
- Area: RUNTIME
- Route/API: /approvals
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 9. [MEDIUM] Console or page errors detected
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 10. [MEDIUM] Console or page errors detected
- Role: Business Development Manager (raoabdulkhaliq786@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 11. [MEDIUM] Console or page errors detected
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 12. [MEDIUM] Console or page errors detected
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: RUNTIME
- Route/API: /projects
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch

### 13. [MEDIUM] Console or page errors detected
- Role: Engineering Technician (raomazeem1122@gmail.com)
- Area: RUNTIME
- Route/API: /expenses
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 14. [MEDIUM] Console or page errors detected
- Role: Procurement + Field Ops (raoibrarulhaq1@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 15. [MEDIUM] Console or page errors detected
- Role: Procurement + Field Ops (raoibrarulhaq1@gmail.com)
- Area: RUNTIME
- Route/API: /expenses
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)

### 16. [MEDIUM] Console or page errors detected
- Role: Engineering Manager (raomubasher5555@gmail.com)
- Area: RUNTIME
- Route/API: /me
- Expected: No severe console/page error on route
- Actual: i: Failed to fetch. Read more at https://errors.authjs.dev#autherror
    at s (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:66981)
    at async w (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:1:68605)
    at async u._getSession (https://erp-staging.automatrix.pk/_next/static/chunks/561b61c0a3be20ff.js:2:1633)

### 17. [MEDIUM] Console or page errors detected
- Role: Engineering Manager (raomubasher5555@gmail.com)
- Area: RUNTIME
- Route/API: /expenses
- Expected: No severe console/page error on route
- Actual: Error loading categories: TypeError: Failed to fetch
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80442
    at https://erp-staging.automatrix.pk/_next/static/chunks/ae1137cba0f8d092.js:1:80793
    at ih (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:102202)
    at uf (https://erp-staging.automatrix.pk/_next/static/chunks/bb307c2998177356.js:1:126052)
