# AGENTS SOP (Mandatory) — AutoMatrix ERP

## BANNER RULE (must follow)
**READ SOP AND FOLLOW BANNER RULE.**

You may not claim *done / fixed / working / improved / secured* unless you include a **Verification Pack** (commands + outputs + tests) and an **Evidence Log** (file snippets with `path:lineRange`).

If you cannot provide evidence, you must write **UNVERIFIED** and stop.

---

This SOP is **binding** for any AI agent working on this repository (Claude, ChatGPT, etc.).

## 0) Prime directive
**Do not waste time or credits.** Prefer **evidence + diffs + reproducible commands** over narrative.

If you cannot verify a claim with repo evidence, you must say: **“UNVERIFIED”** and ask for permission to proceed.

---

## 1) Scope discipline & workflow
### 1.1 Start of every task (required)
1) Restate the user goal in 1–2 lines.
2) List assumptions (if any) and ask questions *only if needed*.
3) Produce a short plan with checkpoints and expected artifacts.

### 1.2 Change control (required)
Any code change must include:
- **Files changed list** (paths)
- **What changed** (1–2 lines per file)
- **How to test** (commands)
- **Test results** (copy/paste output or summary + logs path)

### 1.3 No silent work
Never claim "done" without providing the required artifacts.

---

## 2) Evidence rules (non‑negotiable)
A statement is only allowed if it includes evidence:

### 2.1 Allowed evidence types
- **File evidence**: `path:lineRange` + exact snippet
- **Search evidence**: grep query + matched lines
- **Runtime evidence**: command + output (or log file path)
- **Test evidence**: test command + pass/fail + report path
- **UI evidence**: Playwright trace, screenshot, or recorded steps

### 2.2 Forbidden claim patterns
Do **not** state any of these without proof:
- performance improvements (%, seconds)
- security compliance (OWASP, SOC2, etc.)
- “production ready”
- “comprehensive RBAC”
- “fixed” without tests

If you must mention them, label as **UNVERIFIED** and specify what proof is missing.

### 2.3 Performance claims gate
Any performance claim must include:
- baseline command + logs
- after-change command + logs
- environment info (OS/CPU, Node version)
- variability note (n runs, average)

### 2.4 Runtime claims gate (server running, routes return 200, DB fixed)
Claims like “server is working”, “route X returns 200”, “DB connectivity fixed”, “error code N resolved” are **not allowed** unless you provide:
- the exact command(s) run
- the relevant log output (copy/paste) or a log file path
- for HTTP checks: the exact request used (curl/playwright) + response status/body snippet
- for DB fixes: the error message **before**, the change made (file diff), and the evidence **after**

If you cannot provide this, label the claim **UNVERIFIED**.

---

## 3) Deliverables & artifacts (standard)
Every task must end with a **Task Report** containing:

### 3.1 Task Report format (required)
**Goal:**

**Work performed:**
- Bullet list

**Artifacts produced:**
- Links/paths to files, screenshots, traces, reports

**Files changed:**
- `path`

**Verification:**
- Commands run
- Outputs or report paths

**Known limitations / UNVERIFIED items:**
- Bullet list

**Next steps:**
- Bullet list

---

## 4) Repository rules
### 4.1 Security
- Never commit credentials.
- Use `.env.local` / environment variables.
- Do not log secrets in test output.

### 4.2 Repo hygiene (mandatory)
Agents must **not** commit or rely on repo-unstable artifacts:
- Do not commit: `apps/web/.next/`, `apps/web/node_modules/`, `apps/web/dev.db`, `apps/web/prisma/**/*.db`, Playwright downloads/traces unless explicitly requested.
- Do not commit: `apps/web/.env`, `apps/web/.env.local` (these must be local-only). Only `.env.example` is allowed.
- If any of these appear in `git status`, the agent must call it out in the Task Report and propose the fix (usually `.gitignore` update + removal).

### 4.3 Documentation rules
- Only create new `.md` files when explicitly requested.
- Prefer updating existing docs if they exist.

### 4.4 Testing rules
- Prefer smallest relevant test scope.
- For auth/permissions: add at least one automated test for regressions.

---

## 5) Copy/paste: Claude control prompt (strict)

Paste this at the start of *any* Claude session working on this repo. This prompt is designed to **prevent hallucinated completion** and force evidence-based work.

> You are working in the AutoMatrix ERP repository.
> 
> You MUST comply with `docs/AGENTS_SOP.md` and `docs/DEFINITION_OF_DONE.md`. Treat them as system constraints.
> 
> ### Non‑negotiable rules
> 1) **No claim without evidence.** For every statement like “fixed”, “works”, “improved”, “secured”, you must include ONE of:
>    - `filePath:lineRange` + exact code snippet, OR
>    - command + output (copy/paste), OR
>    - test command + output + report/trace path.
> 2) If you cannot provide evidence, write **UNVERIFIED** and stop.
> 3) **No performance numbers** unless you provide baseline+after logs and environment details.
> 4) **No runtime claims** (server running, route returns 200, DB fixed) unless you provide exact commands and logs.
> 5) **No deliverable claims** unless the file exists in the repo and you quote its path.
> 
> ### Required working format (every response)
> **A) Evidence Log (append-only):**
> - `path:lineRange` snippets OR commands + outputs
> 
> **B) Plan:**
> - 3–7 bullets max
> 
> **C) Changes Made:**
> - list modified files + 1–2 lines each
> 
> **D) Verification Pack (mandatory before “done”):**
> - commands run
> - outputs (or saved log paths)
> - tests run + results
> 
> **E) Task Report:**
> Use the exact template in SOP section 3.1.
> 
> ### Refusal condition
> If you are asked to claim completion without running tests or providing evidence, you must refuse.

---

## 6) Repo-specific verification checklist (high-risk areas)

When working on auth/RBAC/data exposure, you must explicitly check and report evidence for these:

### 6.1 API routes that commonly leak data
- `apps/web/src/app/api/dashboard/route.ts` (must require explicit permission and apply scope filtering)
- `apps/web/src/app/api/attachments/**` (must enforce parent ownership/permission)
- `apps/web/src/app/api/reports/**` and export endpoints (must apply permission + scope + field redaction)
- `apps/web/src/app/api/audit/route.ts` (must restrict + redact sensitive fields)

### 6.2 UI permission gating
- `apps/web/src/components/Sidebar.tsx` (nav must be permission-aware)
- Any admin pages (users/roles) must be hidden/blocked without permission

### 6.3 Field-level access (when requested)
If user asks for “column-level deep” control:
- Implement DTO/redaction helpers (server-side)
- Prove via automated test that restricted fields never appear in API JSON

### 6.4 Permission naming consistency
- Ensure every permission checked by routes/pages exists in the permission source of truth.
- Provide a grep report showing all `assertPermission/requirePermission` usages and the permission list.

---

## 7) Roadmap execution pattern (how agents should implement big work)
When a task is large, agents must use this staged approach:

### Stage A — Evidence collection
- Inventory current behavior and gaps with file/snippet evidence.

### Stage B — Minimal safe fix
- Implement smallest change that fixes the issue.
- Add tests.

### Stage C — Refactor for maintainability
- Only after correctness is proven.

### Stage D — Hardening
- Rate limiting, security headers, observability, performance.

---

## 8) Quality checklist (must self-check before claiming done)
- [ ] No missing permission checks for affected endpoints/pages
- [ ] No sensitive fields returned to unauthorized roles (field-level DTO if needed)
- [ ] Pagination/search present for list endpoints touched
- [ ] Mobile UX not broken (at least responsive check)
- [ ] Tests added/updated and passing
- [ ] All claims backed by evidence
