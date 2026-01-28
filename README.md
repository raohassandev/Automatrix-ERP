# AutoMatrix ERP (Next.js)

Full working scaffold for AutoMatrix ERP with Google auth, Postgres, and Tailwind.

## Requirements
- Node.js LTS
- Postgres

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
