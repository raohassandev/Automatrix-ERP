# File Tree Cleanup Plan (Low-Credit Agent Instructions)

> Goal: **clean, predictable repo layout** before feature work.  
> Outcome: agent can work faster, fewer merge conflicts, clear separation between **legacy Apps Script** and **new Next.js**.

---

## 1) What we have right now (from `Archive 2.zip`)

The extracted project currently looks like this (key parts):

- `archive/src/server/` → modular Google Apps Script backend (GS files)
- `archive/src/client/Index.html` → single-page HTML UI (Apps Script web app)
- `archive/build/` → generated deploy artifact (`Code.gs`, `Index.html`, `appsscript.json`)
- `archive/script.gs` → big combined script (duplicate/alternate build output)
- `archive/scripts/` → clasp/deploy/migration scripts
- `archive/Automatrix_ERP.xlsx` → **legacy** workbook (reference for Next.js migration)
- many `*.md` docs at root

**Problem:** code + build artifacts + backups are mixed. UI/API mismatch exists. Moving to Next.js requires **strict separation**.

---

## 2) Target repository structure (recommended)

Create a clean monorepo layout:

```
/ (repo root)
  apps/
    web/                      # Next.js app (new)
      src/
      prisma/
      public/
      package.json
      next.config.js
      ...
  packages/
    shared/                   # shared types, utils, permission catalog
      src/
      package.json
  legacy/
    apps-script/              # current Apps Script ERP (frozen baseline)
      src/
        server/
        client/
      build/                  # generated output ONLY (optional keep)
      scripts/                # clasp/deploy scripts
      appsscript.json
      README.md               # how to deploy legacy
  data/
    legacy/
      Automatrix_ERP.xlsx     # reference XLSX (do not edit)
      samples/                # optional sanitized samples
  docs/
    product/                  # PRD, roles/permissions spec, workflows
    tech/                     # architecture, DB schema, ADRs
    migration/                # XLSX→DB mapping, import steps
  scripts/
    repo/                     # repo maintenance scripts (lint/format/checks)
  .github/
    workflows/                # CI (lint, test, build)
  README.md
  LICENSE
```

**Principles**
- `apps/web` = **only Next.js**.
- `legacy/apps-script` = **only Apps Script** (no Next.js code).
- `data/legacy` = old XLSX + legacy exports (read-only).
- `docs/` = specs; no code.
- Generated output is either:
  - kept under `legacy/apps-script/build/` (and marked “generated”), **or**
  - excluded from git and produced by CI/build script.

---

## 3) Concrete cleanup steps (agent checklist)

### Step A — Move legacy Apps Script into `legacy/apps-script`
1. Create:
   - `legacy/apps-script/src/server/`
   - `legacy/apps-script/src/client/`
   - `legacy/apps-script/scripts/`
2. Move:
   - `archive/src/server/*` → `legacy/apps-script/src/server/`
   - `archive/src/client/Index.html` → `legacy/apps-script/src/client/Index.html`
   - `archive/scripts/*` → `legacy/apps-script/scripts/`
   - `archive/build/*` → `legacy/apps-script/build/`
3. Keep `legacy/apps-script/README.md` with:
   - deployment method (clasp/manual)
   - how to generate build
   - where to edit source vs build

### Step B — Decide on build artifacts policy (pick one)
**Option 1 (recommended for cleanliness):** treat `build/` as generated
- Add `legacy/apps-script/build/` to `.gitignore`
- Add a build script that generates `build/Code.gs` and `build/Index.html`
- CI can generate artifacts if needed

**Option 2:** keep build artifacts committed (if you deploy by copy/paste)
- Keep `legacy/apps-script/build/` committed
- Add a **banner** comment at top: “DO NOT EDIT — GENERATED”
- Ensure build script overwrites them deterministically

### Step C — Remove or quarantine duplicates
- `archive/script.gs` is a duplicate combined file.
  - Move to `legacy/apps-script/legacy_outputs/script.gs` **or delete** if not used.
- Any `*backup*` scripts:
  - Move to `legacy/apps-script/legacy_outputs/` and mark **deprecated**.

### Step D — Move XLSX reference data
- Move `archive/Automatrix_ERP.xlsx` → `data/legacy/Automatrix_ERP.xlsx`
- Ensure it is treated as **read-only reference**.

### Step E — Docs cleanup
- Create `docs/` and reorganize scattered `*.md`:
  - `docs/product/` → requirements, workflows, role design, approvals, reporting needs
  - `docs/tech/` → architecture, modules, deployment, ADRs
  - `docs/migration/` → XLSX mapping, import plan
- Leave a short root `README.md` that points to:
  - `apps/web` (Next.js)
  - `legacy/apps-script` (legacy)
  - `docs/` (specs)

### Step F — Add repo hygiene tooling (minimal)
- Root:
  - `.editorconfig`
  - `prettier` config
  - `eslint` config (for Next.js)
- `apps/web`:
  - `lint`, `format`, `typecheck` scripts
- Add CI workflow:
  - `pnpm lint`, `pnpm typecheck`, `pnpm build` (or npm/yarn equivalents)

---

## 4) Naming conventions (keep it simple)

- **Folders:** kebab-case (`apps-script`, `legacy_outputs`)
- **Next.js app:** `apps/web`
- **Shared packages:** `packages/shared`
- **Docs:** `docs/product`, `docs/tech`, `docs/migration`

---

## 5) Guardrails to prevent future mess

- No editing generated files:
  - Legacy: edit only `legacy/apps-script/src/**`, generate into `build/**`
- Add a simple “API surface check” (later):
  - grep `google.script.run.<fn>` in client
  - verify server contains function exports (prevents UI/API mismatch)

---

## 6) Final acceptance criteria for cleanup

- ✅ Running `tree -L 3` shows clear separation: `apps/`, `legacy/`, `data/`, `docs/`
- ✅ No duplicate sources for the same system (no more “src vs script.gs confusion”)
- ✅ XLSX is in `data/legacy/`
- ✅ All legacy deployment scripts live under `legacy/apps-script/scripts/`
- ✅ Root README explains how to run Next.js and where the legacy lives

---

## 7) Notes about GitHub access (for you, the user)

- I **can** read GitHub **public repos** if you share the URL and allow me to browse.
- For **private repos**, I can only read them if you:
  - paste files here, or
  - upload a zip, or
  - provide the contents in-chat.

---

### After this cleanup
Once the tree is clean, the next instruction file will define:
- Next.js DB schema (Postgres + Prisma)
- RBAC/permissions catalog + admin UI
- Migration mapping from `Automatrix_ERP.xlsx`
