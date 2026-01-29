# AutoMatrix ERP (Next.js)

Full working scaffold for AutoMatrix ERP with Google auth, Postgres, and Tailwind.

## Requirements
- Node.js LTS
- Postgres


## Early Security Steps
- Copy `.env.example` before running the app and populate `NEXTAUTH_SECRET`, OAuth credentials, and `DATABASE_URL`.
- Run `pnpm security:check` to verify critical secrets are present.
- Track execution-ready work in `PROJECT_BOARD.md` and `MASTER_PLAN_EXECUTION_READY.md`.
- Document every new endpoint via `docs/API_DOCS_TEMPLATE.md`.

## Setup
```bash
pnpm install
cp .env.example .env.local
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

## Key Paths
- UI: `src/app/*`
- API: `src/app/api/*`
- Auth: `src/lib/auth.ts`
- RBAC: `src/lib/rbac.ts`
- Prisma: `prisma/schema.prisma`

## Admin Setup
Set `ADMIN_EMAIL` in `.env.local` to auto-assign Owner role on seed.

## Features Implemented
- Auth (Google) + RBAC
- Expenses + Income + Approvals
- Projects, Inventory, Employees, Invoices (create/list/edit/delete)
- Inventory ledger transaction API
- Wallet ledger transaction API
- Attachments + Notifications (create/list/edit/delete)
- Audit log viewer
- Reports summary page
- Role assignment UI in Settings
