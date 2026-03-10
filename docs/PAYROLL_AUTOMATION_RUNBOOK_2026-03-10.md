# Payroll Automation Runbook (Staging/Prod)

## Purpose

Automatically create a **DRAFT** payroll run every month on a fixed date, then allow manual fine-tuning and per-employee payout settlement.

## New Endpoint

- `POST /api/payroll/runs/auto-draft`

Auth options:
- user session with `payroll.edit` permission, or
- automation token via:
  - `Authorization: Bearer <PAYROLL_AUTOMATION_TOKEN>`
  - `x-payroll-automation-token: <PAYROLL_AUTOMATION_TOKEN>`

## Environment Variables

- `PAYROLL_AUTO_DRAFT_DAY`
  - month day for auto-run trigger
  - range: `1..28`
  - default: `1`
- `PAYROLL_AUTOMATION_TOKEN`
  - strong random secret for scheduler calls

## Scheduler Behavior

- Computes period as **previous month only**.
- If run for that period already exists: returns `skipped`.
- If no eligible entries: returns `skipped`.
- Otherwise creates payroll run as `DRAFT` using policy auto-fill data.

## Suggested Cron (Hostinger VPS)

Run daily at `01:10` server time:

```bash
10 1 * * * curl -sS -X POST 'https://erp-staging.automatrix.pk/api/payroll/runs/auto-draft' \
  -H 'Authorization: Bearer YOUR_PAYROLL_AUTOMATION_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{"force":false}' >/dev/null 2>&1
```

Run immediately (manual/forced):

```bash
curl -sS -X POST 'https://erp-staging.automatrix.pk/api/payroll/runs/auto-draft' \
  -H 'Authorization: Bearer YOUR_PAYROLL_AUTOMATION_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{"force":true}'
```

## Payment Workflow (New)

1. Create/auto-create payroll run in `DRAFT`.
2. Fine-tune amounts as needed.
3. Approve run (`APPROVED`) to freeze and authorize payout.
4. Settle each employee with **Settle Entries -> Mark Paid**.
5. Run auto-moves to `POSTED` when all entries are paid.

## Safety Rules

- Only `DRAFT` runs can edit period/entry rows.
- Posted runs cannot be moved back.
- Payroll run with paid entries cannot be deleted.
- Entry cannot be marked paid twice.

