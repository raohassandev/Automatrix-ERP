# AutoMatrix ERP — Next.js (C&I Engineering)

This repository is a **single Next.js application** for C&I engineering operations.

## Structure
- `src/` — App router, API routes, UI components
- `prisma/` — Database schema and seed
- `public/` — Static assets
- `scripts/` — Dev utilities (seed/import)
- `docs/` — Minimal project docs
- `MASTER_PLAN.md` — Product roadmap

## Setup
```bash
pnpm install
cp .env.example .env.local
pnpm prisma generate
pnpm dev
```

## Commands
```bash
pnpm dev
pnpm build
pnpm test
```

## Notes
- This project uses strict role-based access control and audit logging.
- Keep data flow aligned: **UI ↔ API ↔ DB schema**.
