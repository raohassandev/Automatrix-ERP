# Definition of Done (DoD) — AutoMatrix ERP

## BANNER RULE (must follow)
**READ SOP AND FOLLOW BANNER RULE.**

No agent may claim *done / fixed / working / improved / secured* unless they provide:
- **Evidence Log:** file snippets with `path:lineRange` (or grep matches) for each key claim
- **Verification Pack:** commands run + outputs + tests (or Playwright traces/screens)

If evidence is missing, the claim must be labeled **UNVERIFIED**.

---

This document defines **objective completion criteria** for common task types. Any agent must meet these gates before claiming “done”.

---

## 1) Security / Access Control DoD
### 1.1 Endpoint authorization (required)
- Every modified/added API route calls a centralized auth helper (example: `getCurrentUserOrThrow()`), and enforces at least one of:
  - `assertPermission(user, "...")`, or
  - scoped access (own/team/org) via `where` filters.

**Evidence required:**
- File paths + snippets for each route
- Tests or curl commands proving unauthorized access is blocked

### 1.2 Field/column-level access (when requested)
- Server response **must not include** restricted fields.
- UI hides/disables restricted columns/inputs (secondary; server is primary).

**Evidence required:**
- DTO/redaction function snippet
- Test proving restricted role cannot obtain field even via direct API call

### 1.3 Attachments security
- Attachment access requires permission on its parent entity.
- Direct URL guessing is prevented.

**Evidence required:**
- Route snippet + test demonstrating denial

---

## 2) Performance / Scalability DoD
### 2.1 List endpoints
- Pagination (`take/skip`) implemented.
- Search implemented with indexed fields when applicable.
- Responses use `select` to avoid overfetching.

**Evidence required:**
- Prisma query snippet
- Example request/response size noted

### 2.2 Performance claims gate
No performance improvement claim is allowed unless:
- baseline + after logs are attached
- environment and run count specified

---

## 3) UX/UI & Mobile DoD
### 3.1 Responsiveness
- Target pages render without horizontal overflow at ~375px width.
- Tables have a mobile strategy (card view, column priority, horizontal scroll with sticky key column).

**Evidence required:**
- Screenshot or Playwright visual snapshot

### 3.2 Navigation and permissions
- Navigation only shows items the user can access (or disabled-with-tooltip if product wants discoverability).

**Evidence required:**
- Sidebar/nav rendering snippet + role-based screenshot

### 3.3 Forms
- Validation messages are actionable.
- Defaults reduce data entry time (today’s date, last-used project, etc.) where relevant.

**Evidence required:**
- Form component snippet + example validation behavior

---

## 4) Data Model / Migration DoD
### 4.1 Schema changes
- Prisma schema updated.
- Migration generated and documented.
- Seed updated if needed.

**Evidence required:**
- `schema.prisma` diff
- migration files
- `pnpm prisma migrate ...` command output (or documented alternative)

---

## 5) Testing DoD
### 5.1 Minimum test requirements
- Any auth/permission fix: at least 1 automated test (unit or Playwright).
- Any data model change: migration + at least 1 query path tested.

**Evidence required:**
- test file paths + passing output

---

## 6) Completion gates (anti-hallucination)

### 6.1 No subjective grades or hype
The following are **not allowed** unless you define an objective rubric and provide evidence:
- “Grade: B+ / 85/100”
- “Production-ready”
- “Enterprise-grade”
- “Excellent security” / “OWASP compliant”

If you want to use such terms, you must:
- state the rubric/checklist
- provide proof artifacts for each checklist item

### 6.2 Fix claims must include before/after
For any “fixed” claim, provide:
- the exact error message **before** (logs)
- the exact change applied (diff/snippet)
- the exact verification **after** (logs/tests)

---

## 7) Reporting DoD (what the agent must provide at the end)
Every delivery must include a short report:

- **Goal**
- **Changes**
- **Files changed**
- **How to verify**
- **Proof** (snippets/logs/screens)
- **UNVERIFIED items** (if any)
- **Next steps**
