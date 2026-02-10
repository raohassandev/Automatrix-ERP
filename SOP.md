# SOP — AutoMatrix ERP (Phase 1)

**Purpose:** Execution rules for building and operating AutoMatrix ERP without scope creep, data loss, or “prototype shortcuts.”

This SOP complements `MASTER_PLAN_NEW.md` (product + workflows) with concrete engineering + ops defaults.

---

## 1) Source of truth (docs)
- `MASTER_PLAN_NEW.md` — Phase scope, workflows, DoD, locked appendices
- `SOP.md` — execution + production/ops rules (this file)
- `AUDIT_V1.md` — evidence-based audit + backlog inputs
- `docs/ERP_DIAGRAMS.md` — diagrams (keep updated when workflows change)

If two docs conflict: **appendices in `MASTER_PLAN_NEW.md` win** (LOCKED defaults).

---

## 2) Non‑negotiables (ERP-grade)
- All business documents follow lifecycle: `DRAFT → SUBMITTED → APPROVED → POSTED → LOCKED/CANCELLED`.
- After `POSTED`: **no value-bearing edits**. Use cancel/reversal/adjustment docs.
- All ledger/posting records must store: `sourceType`, `sourceId`, `postedBy`, `postedAt`.
- Every API action enforces RBAC server-side (no UI-only checks).
- Every finance/inventory critical action writes an audit log entry.
- No prompt-based edits for finance/inventory in production UI.

---

## 3) Auth & provisioning (LOCKED — Phase 1)
- **Google OAuth only** (no credentials login).
- **No public signup** in production.
- Users must be **Admin-provisioned / allowlisted** before they can log in.
- Unknown emails must be denied at sign-in (do not auto-create users/employees in prod).
- All provisioning and role changes must be audited.

Auth domains + redirect URIs (LOCKED):
- `NEXTAUTH_URL`:
  - prod: `https://erp.automatrix.pk`
  - staging: `https://erp-staging.automatrix.pk`
- Google OAuth redirect URIs (Google Console):
  - `https://erp.automatrix.pk/api/auth/callback/google`
  - `https://erp-staging.automatrix.pk/api/auth/callback/google`
- Secrets (server env only, never committed):
  - `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

---

## 4) Engineering workflow (every feature)
Order of work (no skipping):
1. Update schema (Prisma) + migrations (for real data safety)
2. Add/adjust validation schemas
3. Implement API routes (RBAC + audit + invariants)
4. Implement UI (structured forms + lifecycle actions)
5. Add tests (unit for business rules; integration/e2e for doc chains)
6. Run gates (below)

---

## 5) Quality gates (before pushing)
Must pass locally:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Conditional gates:
- If `prisma/schema.prisma` changed:
  - run `pnpm prisma:generate`
  - run `pnpm prisma:migrate` (local only) and verify migrations
- If a document chain was changed (Purchasing/Sales/Inventory postings):
  - run Playwright for that chain (`pnpm test:e2e` or the specific spec)

Any exception must be explicitly documented in a commit message and tracked as a Critical audit item.

---

## 6) Database rules (LOCKED — real data)
- Staging/prod: **ONLY** `prisma migrate deploy`.
- Never run `prisma db push` on staging/prod.
- Never delete/rewind migration history on prod.
- Backups are mandatory before migrations (see ops section).

---

## 7) Production operations (LOCKED — Appendix B)
Follow `MASTER_PLAN_NEW.md` Appendix B for:
- environments + branch mapping (dev→staging, main→prod)
- Nginx + PM2 deployment model
- backup/restore and offsite storage
- firewall + secrets
- monitoring + health endpoint expectations
- governance rules (no hard delete for posted docs, export logging)

This SOP does not override Appendix B; it references it.

---

## 8) Data governance (Phase 1)
- Audit log retention: minimum 2 years.
- Exports must be permission gated and audited.
- PII fields (CNIC/address) must be permission-gated and auditable.

---

## 9) Codex cost guardrails (keep changes economical)
- Before coding: output a short plan (<= 10 lines) + list exact files to touch.
- Default limit: max 3 files changed per task (unless the user explicitly asks otherwise).
- Avoid repo-wide refactors; do targeted, minimal changes.
- Prefer patching existing code over rewriting modules.
