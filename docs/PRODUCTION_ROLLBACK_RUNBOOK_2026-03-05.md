# Production Rollback Runbook (ERP)

Date: 2026-03-05  
Target: `https://erp.automatrix.pk`  
App path: `/var/www/automatrix-erp-prod`  
Process: `automatrix-erp-prod` (PM2, port `3030`)

## 1) Preconditions

1. Incident declared and approved by Owner/CEO/CFO.
2. Current prod backup exists (custom dump in `/var/backups/automatrix-erp`).
3. Rollback target commit and DB restore point identified.

## 2) Required Inputs

1. `ROLLBACK_COMMIT` (known good commit on `origin/main`)
2. `ROLLBACK_DB_DUMP` (known good dump file, example: `/var/backups/automatrix-erp/automatrix_erp_prod_pre_restore_YYYYMMDD-HHMMSS.dump`)
3. Incident channel + approver names

## 3) Read-Only Precheck

```bash
ssh hostinger-vps
cd /var/www/automatrix-erp-prod
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
pm2 status automatrix-erp-prod --no-color
curl -fsS http://127.0.0.1:3030/api/health
```

## 4) Application Rollback (Code)

```bash
ssh hostinger-vps
cd /var/www/automatrix-erp-prod
git fetch --all --prune
git checkout -B main origin/main
git reset --hard <ROLLBACK_COMMIT>
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
pm2 restart automatrix-erp-prod --update-env
curl -fsS http://127.0.0.1:3030/api/health
```

## 5) Database Rollback (Only If Data Rollback Required)

Important: this restores the database to snapshot state and will remove newer writes.

```bash
ssh hostinger-vps
cd /var/www/automatrix-erp-prod
RAW_URL=$(awk -F= '/^DATABASE_URL=/{print substr($0,index($0,$2)); exit}' .env | tr -d '"')
DB_URL="${RAW_URL%%\?*}"

# safety backup before restore
TS=$(date -u +%Y%m%d-%H%M%S)
pg_dump "$DB_URL" -Fc -f "/var/backups/automatrix-erp/automatrix_erp_prod_pre_rollback_${TS}.dump"

# restore target snapshot
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DB_URL" "<ROLLBACK_DB_DUMP>"

# ensure schema compatibility with rollback commit
pnpm prisma:migrate:deploy
pm2 restart automatrix-erp-prod --update-env
curl -fsS http://127.0.0.1:3030/api/health
```

## 6) Post-Rollback Validation

1. Health endpoint OK.
2. Owner login OK.
3. Finance pages load:
   - `/dashboard`
   - `/reports/accounting/cash-position`
   - `/approvals`
4. Critical API checks:
   - `/api/health`
   - `/api/me/effective-permissions`
5. DB row sanity (no null explosions on core tables).

## 7) Roll-Forward Plan

1. Stabilize fix in `dev`.
2. Run staging deep audit + role audit.
3. Promote to `main`.
4. Re-run cutover checklist before redeploying production.

