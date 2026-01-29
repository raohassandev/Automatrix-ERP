# Phase 1 Security & Critical Fixes

This document tracks the high-priority security actions from Phase 1 of the master plan.

## 1. NEXTAUTH_SECRET rotation
- Generate a 32-byte secret: `openssl rand -base64 32`
- Store it in `.env.local` as `NEXTAUTH_SECRET`
- Restart `pnpm dev` / production server
- Verify `pnpm security:check` returns no missing variables

## 2. Credential validation & duplicates
- Registration already validates via Zod; ensure consumers respect the minimum password length (8 chars)
- Login now rejects users without `passwordHash`; any existing plaintext rows must be rehashed
- Duplicate expenses are only allowed when the same user submits them, preventing fraud

## 3. Audit logging & traceability
- `logAudit` is invoked for every CRUD action (expenses, income, approvals, attachments, wallet)
- Review `src/lib/audit.ts` for hook details and extend when adding new APIs

## 4. Security health command
- Run `pnpm security:check` before launching the app to ensure required env vars are defined

## 5. Next steps
- Add automated vulnerability scanning in CI (npm audit / `npm audit --audit-level=high`)
- Harden database credentials (rotate, use least privilege)
- Review RBAC permissions when adding new modules
