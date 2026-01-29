# AutoMatrix ERP Project Board

## Phase 1: Security & Critical Fixes
| Task | Status | Owner | Notes |
|---|---|---|---|
| SEC-001: Rotate NEXTAUTH_SECRET and enforce env check | Done | CODEX | Run `pnpm security:check` before each deployment |
| SEC-002: Harden register/login validation | In Progress | Dev Team | Already uses Zod + audit logging; update UI messages |
| SEC-003: Document audit flows | Done | CODEX | See `SECURITY.md` and `src/lib/audit.ts` |
| QW-009: Implement automatic audit logging | Done | CODEX | Added middleware to log all API mutations |

## Phase 2: Approval Workflow
| Task | Status | Owner | Notes |
| APR-010: Add CSV exports for approvals | Done | CODEX | `/api/expenses/export`, `/api/income/export`, `/api/reports/export`
| APR-020: Build multi-level approval UI | In Progress | CODEX | Modal-based approval table already implemented |
| APR-003: Implement approval status transitions | Done | CODEX | Implemented PENDING -> APPROVED -> PAID status transition for expenses |

## Phase 3: Dashboard & Reporting
| Task | Status | Owner | Notes |
|---|---|---|---|
| REP-001: Display KPI cards on dashboard | Done | CODEX | Use `getDashboardDataEnhanced`
| REP-002: Export reports (CSV) | Done | CODEX | `/api/reports/export` |
| QW-012: Create PDF export for reports | Done | CODEX | Added PDF export for expenses report |
| QW-013: Add low stock alerts to dashboard | Done | CODEX | Low stock alerts are already displayed on the dashboard |
| DASH-CHART-002: Income vs Expense trend (line chart) | Done | CODEX | Added an income vs expense trend chart to the dashboard |
| DASH-CHART-003: Expense by category (pie chart) | Done | CODEX | Added an expense by category pie chart to the dashboard |
| DASH-CHART-004: Project profitability (bar chart) | Done | CODEX | Added a project profitability bar chart to the dashboard |
| DASH-CHART-005: Wallet balance trend (area chart) | Done | CODEX | Added a wallet balance trend chart to the dashboard |

## General UI/UX
| Task | Status | Owner | Notes |
|---|---|---|---|
| UI-001: Install and configure component library | Done | CODEX | Installed shadcn/ui and added base components |
| QW-003: Add loading spinners to all buttons | Done | CODEX | Added loading spinners to buttons in the approval workflow |
| QW-004: Add toast notifications for success/error | Done | CODEX | Implemented toast notifications in the approval workflow |
| QW-015: Add mobile responsive menu | Done | CODEX | Implemented a mobile responsive menu |
| FORM-002: Add autocomplete/typeahead for categories | Done | CODEX | Added autocomplete for the category field in expense form |
| UI-006: Implement dark mode | Done | CODEX | Implemented dark mode with ThemeToggle component |

## Testing
| Task | Status | Owner | Notes |
|---|---|---|---|
| TEST-001: Set up Vitest testing framework | Done | CODEX | Installed and configured Vitest with a sample test |

## Expenses
| Task | Status | Owner | Notes |
|---|---|---|---|
| QW-006: Add pagination to expenses list | Done | CODEX | Added pagination to the expenses list |
| QW-007: Add search to expenses list | Done | CODEX | Added search functionality to the expenses list |
| QW-008: Add date range filter to expenses | Done | CODEX | Added a date range filter to the expenses list |
| TABLE-002: Add sorting to expenses list | Done | CODEX | Added sorting to the expenses list |
| TABLE-004: Add column visibility toggle | Done | CODEX | Added column visibility toggle to the expenses list |

## Notifications
| Task | Status | Owner | Notes |
|---|---|---|---|
| QW-014: Implement notification service | Done | CODEX | Basic notification service is already implemented and used |

## Tracking guidelines
- Move tasks between columns by updating this file
- Reference `MASTER_PLAN_EXECUTION_READY.md` by Task ID for acceptance details
- Use `docs/API_DOCS_TEMPLATE.md` when adding new API endpoints
