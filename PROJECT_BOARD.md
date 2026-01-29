# AutoMatrix ERP Project Board

## Phase 1: Security & Critical Fixes
| Task | Status | Owner | Notes |
|---|---|---|---|
| SEC-001: Rotate NEXTAUTH_SECRET and enforce env check | To Do | CODEX | Run `pnpm security:check` before each deployment |
| SEC-002: Harden register/login validation | In Progress | Dev Team | Already uses Zod + audit logging; update UI messages |
| SEC-003: Document audit flows | Done | CODEX | See `SECURITY.md` and `src/lib/audit.ts` |

## Phase 2: Approval Workflow
| Task | Status | Owner | Notes |
| APR-010: Add CSV exports for approvals | Done | CODEX | `/api/expenses/export`, `/api/income/export`, `/api/reports/export`
| APR-020: Build multi-level approval UI | In Progress | CODEX | Modal-based approval table already implemented |

## Phase 3: Dashboard & Reporting
| Task | Status | Owner | Notes |
| REP-001: Display KPI cards on dashboard | To Do | CODEX | Use `getDashboardDataEnhanced`
| REP-002: Export reports (CSV) | Done | CODEX | `/api/reports/export`

## Tracking guidelines
- Move tasks between columns by updating this file
- Reference `MASTER_PLAN_EXECUTION_READY.md` by Task ID for acceptance details
- Use `docs/API_DOCS_TEMPLATE.md` when adding new API endpoints
