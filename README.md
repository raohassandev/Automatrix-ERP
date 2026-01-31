# AutoMatrix ERP Monorepo

This repository now follows a monorepo structure, separating the new Next.js application from the legacy Google Apps Script ERP and organizing documentation and data.

## Monorepo Structure

-   **`apps/web/`**: Contains the new Next.js application. This is where active development for the web-based ERP takes place.
    -   [Next.js App README](apps/web/README.md) (To be created)
-   **`legacy/apps-script/`**: Contains the original Google Apps Script ERP code and related files. This is considered a frozen baseline.
    -   [Legacy Apps Script README](legacy/apps-script/README.md)
-   **`data/legacy/`**: Stores legacy data, such as the original `Automatrix_ERP.xlsx` spreadsheet, used for migration reference.
    -   [Legacy Data README](data/legacy/README.md) (To be created)
-   **`docs/`**: Houses all project documentation, including product specifications, technical architecture, and migration plans.
    -   [Project Documentation Overview](docs/README.md) (To be created)
-   **`scripts/`**: Contains repository-level maintenance scripts.
-   **`.github/`**: Configuration for GitHub Actions CI/CD workflows.

## Next.js Application Overview (`apps/web`)

This section describes the Next.js application, which is the focus of ongoing development.

### Requirements
- Node.js LTS
- Postgres

### Early Security Steps
- Copy `.env.example` before running the app and populate `NEXTAUTH_SECRET`, OAuth credentials, and `DATABASE_URL`.
- Run `pnpm security:check` to verify critical secrets are present.
- Track execution-ready work in `docs/product/PROJECT_BOARD.md` and `docs/migration/MASTER_PLAN_EXECUTION_READY.md`.
- Document every new endpoint via `docs/tech/API_DOCS_TEMPLATE.md`.

### Setup (`apps/web`)
```bash
pnpm install
cp .env.example .env.local
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

### Key Paths (`apps/web`)
- UI: `src/app/*`
- API: `src/app/api/*`
- Auth: `src/lib/auth.ts`
- RBAC: `src/lib/rbac.ts`
- Prisma: `prisma/schema.prisma`

### Admin Setup (`apps/web`)
Set `ADMIN_EMAIL` in `.env.local` to auto-assign Owner role on seed.

### Features Implemented (`apps/web`)
- Auth (Google) + RBAC
- Expenses + Income + Approvals
- Projects, Inventory, Employees, Invoices (create/list/edit/delete)
- Inventory ledger transaction API
- Wallet ledger transaction API
- Attachments + Notifications (create/list/edit/delete)
- Audit log viewer
- Reports summary page
- Role assignment UI in Settings
- Dark mode toggle
- Responsive mobile menu
- Pagination, search, sorting, and column visibility for expenses list
- Autocomplete for expense categories, income sources, and payment modes
