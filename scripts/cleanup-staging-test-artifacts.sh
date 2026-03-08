#!/usr/bin/env bash
set -euo pipefail

# Staging-only test artifact cleanup.
# Default mode is preview (non-destructive).

MODE="${MODE:-preview}" # preview | execute
SSH_TARGET="${SSH_TARGET:-hostinger-vps}"
APP_DIR="${APP_DIR:-/var/www/automatrix-erp-staging}"
LOG_DIR="${LOG_DIR:-docs}"
TS="$(date -u +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/STAGING_TEST_ARTIFACT_CLEANUP_${TS}.txt"

mkdir -p "${LOG_DIR}"

echo "Cleanup mode: ${MODE}" | tee "${LOG_FILE}"
echo "Target: ${SSH_TARGET}" | tee -a "${LOG_FILE}"
echo "App dir: ${APP_DIR}" | tee -a "${LOG_FILE}"

read -r -d '' PREVIEW_SQL <<'SQL' || true
CREATE TEMP TABLE tmp_projects AS
SELECT id FROM "Project"
WHERE "projectId" ILIKE 'PRJ-E2E-%'
   OR "projectId" ILIKE 'SMOKE-%'
   OR "projectId" ILIKE 'STAGING-%'
   OR name ILIKE '%E2E%'
   OR name ILIKE '%SMOKE%'
   OR name ILIKE '%STAGING%'
   OR name ILIKE '%PLAYWRIGHT%';

CREATE TEMP TABLE tmp_clients AS
SELECT id FROM "Client"
WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%';

CREATE TEMP TABLE tmp_vendors AS
SELECT id FROM "Vendor"
WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%' OR COALESCE("contactName",'') ILIKE '%E2E%';

CREATE TEMP TABLE tmp_items AS
SELECT id FROM "InventoryItem"
WHERE name ILIKE '%E2E%' OR COALESCE(sku,'') ILIKE '%E2E%' OR category ILIKE '%E2E%'
   OR name ILIKE '%SMOKE%' OR COALESCE(sku,'') ILIKE '%SMOKE%'
   OR name ILIKE '%STAGING%' OR COALESCE(sku,'') ILIKE '%STAGING%';

CREATE TEMP TABLE tmp_accounts AS
SELECT id FROM "CompanyAccount"
WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%';

CREATE TEMP TABLE tmp_expenses AS
SELECT id FROM "Expense"
WHERE description ILIKE '%E2E%' OR description ILIKE '%SMOKE%' OR description ILIKE '%STAGING%' OR description ILIKE 'MOBILE_EXP_SMOKE_%'
   OR category ILIKE '%E2E%' OR category ILIKE '%SMOKE%' OR category ILIKE '%STAGING%'
   OR COALESCE(project,'') ILIKE 'PRJ-E2E-%'
   OR COALESCE("externalId",'') ILIKE '%E2E%'
   OR COALESCE("companyAccountId",'') IN (SELECT id FROM tmp_accounts);

CREATE TEMP TABLE tmp_incomes AS
SELECT id FROM "Income"
WHERE source ILIKE '%E2E%' OR source ILIKE '%SMOKE%' OR source ILIKE '%STAGING%' OR category ILIKE '%E2E%' OR category ILIKE '%SMOKE%' OR category ILIKE '%STAGING%'
   OR COALESCE(project,'') ILIKE 'PRJ-E2E-%'
   OR COALESCE("externalId",'') ILIKE '%E2E%'
   OR COALESCE("companyAccountId",'') IN (SELECT id FROM tmp_accounts);

CREATE TEMP TABLE tmp_po AS
SELECT id FROM "PurchaseOrder"
WHERE "poNumber" ILIKE '%E2E%' OR "poNumber" ILIKE '%SMOKE%' OR "poNumber" ILIKE '%STAGING%'
   OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR "vendorName" ILIKE '%E2E%' OR "vendorName" ILIKE '%SMOKE%' OR "vendorName" ILIKE '%STAGING%'
   OR COALESCE("vendorId",'') IN (SELECT id FROM tmp_vendors);

CREATE TEMP TABLE tmp_grn AS
SELECT id FROM "GoodsReceipt"
WHERE "grnNumber" ILIKE '%E2E%' OR "grnNumber" ILIKE '%SMOKE%' OR "grnNumber" ILIKE '%STAGING%' OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%';

CREATE TEMP TABLE tmp_bills AS
SELECT id FROM "VendorBill"
WHERE "billNumber" ILIKE '%E2E%' OR "billNumber" ILIKE '%SMOKE%' OR "billNumber" ILIKE '%STAGING%' OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(notes,'') ILIKE '%E2E%' OR COALESCE(notes,'') ILIKE '%SMOKE%' OR COALESCE(notes,'') ILIKE '%STAGING%'
   OR COALESCE("vendorId",'') IN (SELECT id FROM tmp_vendors);

CREATE TEMP TABLE tmp_payments AS
SELECT id FROM "VendorPayment"
WHERE "paymentNumber" ILIKE '%E2E%' OR "paymentNumber" ILIKE '%SMOKE%' OR "paymentNumber" ILIKE '%STAGING%' OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(notes,'') ILIKE '%E2E%' OR COALESCE(notes,'') ILIKE '%SMOKE%' OR COALESCE(notes,'') ILIKE '%STAGING%'
   OR COALESCE("vendorId",'') IN (SELECT id FROM tmp_vendors)
   OR COALESCE("companyAccountId",'') IN (SELECT id FROM tmp_accounts);

CREATE TEMP TABLE tmp_incentives AS
SELECT id FROM "IncentiveEntry"
WHERE COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(reason,'') ILIKE '%E2E%' OR COALESCE(reason,'') ILIKE '%SMOKE%' OR COALESCE(reason,'') ILIKE '%STAGING%' OR COALESCE(reason,'') ILIKE 'smk_%';

CREATE TEMP TABLE tmp_advances AS
SELECT id FROM "SalaryAdvance"
WHERE reason ILIKE '%E2E%' OR reason ILIKE '%SMOKE%' OR reason ILIKE '%STAGING%' OR reason ILIKE 'smk_%';

CREATE TEMP TABLE tmp_runs AS
SELECT id FROM "PayrollRun"
WHERE COALESCE(notes,'') ILIKE '%E2E%' OR COALESCE(notes,'') ILIKE '%SMOKE%' OR COALESCE(notes,'') ILIKE '%STAGING%' OR COALESCE(notes,'') ILIKE 'smk_%';

CREATE TEMP TABLE tmp_entries AS
SELECT id FROM "PayrollEntry" WHERE "payrollRunId" IN (SELECT id FROM tmp_runs);

CREATE TEMP TABLE tmp_commissions AS
SELECT id FROM "CommissionEntry"
WHERE COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(reason,'') ILIKE '%E2E%' OR COALESCE(reason,'') ILIKE '%SMOKE%' OR COALESCE(reason,'') ILIKE '%STAGING%' OR COALESCE(reason,'') ILIKE 'smk_%';

SELECT 'projects' AS entity, count(*) AS rows FROM tmp_projects
UNION ALL SELECT 'clients', count(*) FROM tmp_clients
UNION ALL SELECT 'vendors', count(*) FROM tmp_vendors
UNION ALL SELECT 'items', count(*) FROM tmp_items
UNION ALL SELECT 'company_accounts', count(*) FROM tmp_accounts
UNION ALL SELECT 'expenses', count(*) FROM tmp_expenses
UNION ALL SELECT 'incomes', count(*) FROM tmp_incomes
UNION ALL SELECT 'purchase_orders', count(*) FROM tmp_po
UNION ALL SELECT 'goods_receipts', count(*) FROM tmp_grn
UNION ALL SELECT 'vendor_bills', count(*) FROM tmp_bills
UNION ALL SELECT 'vendor_payments', count(*) FROM tmp_payments
UNION ALL SELECT 'incentives', count(*) FROM tmp_incentives
UNION ALL SELECT 'salary_advances', count(*) FROM tmp_advances
UNION ALL SELECT 'payroll_runs', count(*) FROM tmp_runs
UNION ALL SELECT 'payroll_entries', count(*) FROM tmp_entries
UNION ALL SELECT 'commissions', count(*) FROM tmp_commissions
ORDER BY entity;
SQL

read -r -d '' DELETE_SQL <<'SQL' || true
BEGIN;

-- same scoped sets
CREATE TEMP TABLE tmp_projects AS
SELECT id FROM "Project"
WHERE "projectId" ILIKE 'PRJ-E2E-%'
   OR "projectId" ILIKE 'SMOKE-%'
   OR "projectId" ILIKE 'STAGING-%'
   OR name ILIKE '%E2E%'
   OR name ILIKE '%SMOKE%'
   OR name ILIKE '%STAGING%'
   OR name ILIKE '%PLAYWRIGHT%';

CREATE TEMP TABLE tmp_clients AS
SELECT id FROM "Client"
WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%';

CREATE TEMP TABLE tmp_vendors AS
SELECT id FROM "Vendor"
WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%' OR COALESCE("contactName",'') ILIKE '%E2E%';

CREATE TEMP TABLE tmp_items AS
SELECT id FROM "InventoryItem"
WHERE name ILIKE '%E2E%' OR COALESCE(sku,'') ILIKE '%E2E%' OR category ILIKE '%E2E%'
   OR name ILIKE '%SMOKE%' OR COALESCE(sku,'') ILIKE '%SMOKE%'
   OR name ILIKE '%STAGING%' OR COALESCE(sku,'') ILIKE '%STAGING%';

CREATE TEMP TABLE tmp_accounts AS
SELECT id FROM "CompanyAccount"
WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%';

CREATE TEMP TABLE tmp_expenses AS
SELECT id FROM "Expense"
WHERE description ILIKE '%E2E%' OR description ILIKE '%SMOKE%' OR description ILIKE '%STAGING%' OR description ILIKE 'MOBILE_EXP_SMOKE_%'
   OR category ILIKE '%E2E%' OR category ILIKE '%SMOKE%' OR category ILIKE '%STAGING%'
   OR COALESCE(project,'') ILIKE 'PRJ-E2E-%'
   OR COALESCE("externalId",'') ILIKE '%E2E%'
   OR COALESCE("companyAccountId",'') IN (SELECT id FROM tmp_accounts);

CREATE TEMP TABLE tmp_incomes AS
SELECT id FROM "Income"
WHERE source ILIKE '%E2E%' OR source ILIKE '%SMOKE%' OR source ILIKE '%STAGING%' OR category ILIKE '%E2E%' OR category ILIKE '%SMOKE%' OR category ILIKE '%STAGING%'
   OR COALESCE(project,'') ILIKE 'PRJ-E2E-%'
   OR COALESCE("externalId",'') ILIKE '%E2E%'
   OR COALESCE("companyAccountId",'') IN (SELECT id FROM tmp_accounts);

CREATE TEMP TABLE tmp_po AS
SELECT id FROM "PurchaseOrder"
WHERE "poNumber" ILIKE '%E2E%' OR "poNumber" ILIKE '%SMOKE%' OR "poNumber" ILIKE '%STAGING%'
   OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR "vendorName" ILIKE '%E2E%' OR "vendorName" ILIKE '%SMOKE%' OR "vendorName" ILIKE '%STAGING%'
   OR COALESCE("vendorId",'') IN (SELECT id FROM tmp_vendors);

CREATE TEMP TABLE tmp_grn AS
SELECT id FROM "GoodsReceipt"
WHERE "grnNumber" ILIKE '%E2E%' OR "grnNumber" ILIKE '%SMOKE%' OR "grnNumber" ILIKE '%STAGING%' OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%';

CREATE TEMP TABLE tmp_bills AS
SELECT id FROM "VendorBill"
WHERE "billNumber" ILIKE '%E2E%' OR "billNumber" ILIKE '%SMOKE%' OR "billNumber" ILIKE '%STAGING%' OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(notes,'') ILIKE '%E2E%' OR COALESCE(notes,'') ILIKE '%SMOKE%' OR COALESCE(notes,'') ILIKE '%STAGING%'
   OR COALESCE("vendorId",'') IN (SELECT id FROM tmp_vendors);

CREATE TEMP TABLE tmp_payments AS
SELECT id FROM "VendorPayment"
WHERE "paymentNumber" ILIKE '%E2E%' OR "paymentNumber" ILIKE '%SMOKE%' OR "paymentNumber" ILIKE '%STAGING%' OR COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(notes,'') ILIKE '%E2E%' OR COALESCE(notes,'') ILIKE '%SMOKE%' OR COALESCE(notes,'') ILIKE '%STAGING%'
   OR COALESCE("vendorId",'') IN (SELECT id FROM tmp_vendors)
   OR COALESCE("companyAccountId",'') IN (SELECT id FROM tmp_accounts);

CREATE TEMP TABLE tmp_incentives AS
SELECT id FROM "IncentiveEntry"
WHERE COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(reason,'') ILIKE '%E2E%' OR COALESCE(reason,'') ILIKE '%SMOKE%' OR COALESCE(reason,'') ILIKE '%STAGING%' OR COALESCE(reason,'') ILIKE 'smk_%';

CREATE TEMP TABLE tmp_advances AS
SELECT id FROM "SalaryAdvance"
WHERE reason ILIKE '%E2E%' OR reason ILIKE '%SMOKE%' OR reason ILIKE '%STAGING%' OR reason ILIKE 'smk_%';

CREATE TEMP TABLE tmp_runs AS
SELECT id FROM "PayrollRun"
WHERE COALESCE(notes,'') ILIKE '%E2E%' OR COALESCE(notes,'') ILIKE '%SMOKE%' OR COALESCE(notes,'') ILIKE '%STAGING%' OR COALESCE(notes,'') ILIKE 'smk_%';

CREATE TEMP TABLE tmp_entries AS
SELECT id FROM "PayrollEntry" WHERE "payrollRunId" IN (SELECT id FROM tmp_runs);

CREATE TEMP TABLE tmp_commissions AS
SELECT id FROM "CommissionEntry"
WHERE COALESCE("projectRef",'') ILIKE 'PRJ-E2E-%' OR COALESCE("projectRef",'') ILIKE 'STAGING-%'
   OR COALESCE(reason,'') ILIKE '%E2E%' OR COALESCE(reason,'') ILIKE '%SMOKE%' OR COALESCE(reason,'') ILIKE '%STAGING%' OR COALESCE(reason,'') ILIKE 'smk_%';

DELETE FROM "Approval" WHERE "expenseId" IN (SELECT id FROM tmp_expenses) OR "incomeId" IN (SELECT id FROM tmp_incomes);
DELETE FROM "PayrollComponentLine" WHERE "payrollEntryId" IN (SELECT id FROM tmp_entries)
  OR COALESCE(description,'') ILIKE '%SMOKE%' OR COALESCE(description,'') ILIKE '%E2E%' OR COALESCE("sourceId",'') ILIKE '%smk_%';
DELETE FROM "JournalLine" WHERE "projectId" IN (SELECT id FROM tmp_projects);
DELETE FROM "JournalEntry"
WHERE COALESCE("sourceId",'') IN (SELECT id FROM tmp_expenses UNION SELECT id FROM tmp_incomes UNION SELECT id FROM tmp_bills UNION SELECT id FROM tmp_payments)
   OR COALESCE(memo,'') ILIKE '%E2E%' OR COALESCE(memo,'') ILIKE '%SMOKE%';
DELETE FROM "PostingBatch"
WHERE COALESCE("sourceId",'') IN (SELECT id FROM tmp_expenses UNION SELECT id FROM tmp_incomes UNION SELECT id FROM tmp_bills UNION SELECT id FROM tmp_payments)
   OR COALESCE("sourceId",'') ILIKE '%smk_%';

DELETE FROM "VendorPaymentAllocation"
WHERE "vendorPaymentId" IN (SELECT id FROM tmp_payments)
   OR "vendorBillId" IN (SELECT id FROM tmp_bills)
   OR COALESCE("sourceId",'') ILIKE '%smk_%';
DELETE FROM "VendorBillLine" WHERE "vendorBillId" IN (SELECT id FROM tmp_bills);
DELETE FROM "GoodsReceiptItem"
WHERE "goodsReceiptId" IN (SELECT id FROM tmp_grn)
   OR "purchaseOrderItemId" IN (SELECT id FROM "PurchaseOrderItem" WHERE "purchaseOrderId" IN (SELECT id FROM tmp_po));
DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" IN (SELECT id FROM tmp_po);

DELETE FROM "ProjectAssignment" WHERE "projectId" IN (SELECT id FROM tmp_projects);
DELETE FROM "ProjectTask" WHERE "projectId" IN (SELECT id FROM tmp_projects);

DELETE FROM "WalletLedger"
WHERE COALESCE("sourceId",'') IN (
  SELECT id FROM tmp_expenses UNION SELECT id FROM tmp_incomes UNION SELECT id FROM tmp_incentives UNION SELECT id FROM tmp_advances UNION SELECT id FROM tmp_entries
)
   OR COALESCE(reference,'') ILIKE '%E2E%'
   OR COALESCE(reference,'') ILIKE '%SMOKE%'
   OR COALESCE(reference,'') ILIKE 'smk_%';

DELETE FROM "InventoryLedger"
WHERE "itemId" IN (SELECT id FROM tmp_items)
   OR COALESCE(reference,'') ILIKE '%E2E%'
   OR COALESCE(reference,'') ILIKE '%SMOKE%'
   OR COALESCE(reference,'') ILIKE 'smk_%';

DELETE FROM "Attachment"
WHERE COALESCE("recordId",'') IN (
  SELECT id FROM tmp_projects UNION SELECT id FROM tmp_bills UNION SELECT id FROM tmp_payments UNION SELECT id FROM tmp_expenses UNION SELECT id FROM tmp_incomes
)
   OR "fileName" ILIKE '%E2E%'
   OR "fileName" ILIKE '%SMOKE%'
   OR "fileName" ILIKE '%PLAYWRIGHT%';

DELETE FROM "Notification" WHERE message ILIKE '%E2E%' OR message ILIKE '%SMOKE%' OR message ILIKE '%PLAYWRIGHT%';
DELETE FROM "AuditLog"
WHERE COALESCE("entityId",'') IN (
  SELECT id FROM tmp_projects UNION SELECT id FROM tmp_expenses UNION SELECT id FROM tmp_incomes UNION SELECT id FROM tmp_bills UNION SELECT id FROM tmp_payments
)
   OR COALESCE(reason,'') ILIKE '%E2E%'
   OR COALESCE(reason,'') ILIKE '%SMOKE%'
   OR COALESCE("newValue",'') ILIKE '%E2E%'
   OR COALESCE("newValue",'') ILIKE '%SMOKE%';

DELETE FROM "Expense" WHERE id IN (SELECT id FROM tmp_expenses);
DELETE FROM "Income" WHERE id IN (SELECT id FROM tmp_incomes);
DELETE FROM "CommissionEntry" WHERE id IN (SELECT id FROM tmp_commissions);
DELETE FROM "IncentiveEntry" WHERE id IN (SELECT id FROM tmp_incentives);
DELETE FROM "SalaryAdvance" WHERE id IN (SELECT id FROM tmp_advances);
DELETE FROM "PayrollEntry" WHERE id IN (SELECT id FROM tmp_entries);
DELETE FROM "PayrollRun" WHERE id IN (SELECT id FROM tmp_runs);
DELETE FROM "VendorPayment" WHERE id IN (SELECT id FROM tmp_payments);
DELETE FROM "VendorBill" WHERE id IN (SELECT id FROM tmp_bills);
DELETE FROM "GoodsReceipt" WHERE id IN (SELECT id FROM tmp_grn);
DELETE FROM "PurchaseOrder" WHERE id IN (SELECT id FROM tmp_po);
DELETE FROM "Project" WHERE id IN (SELECT id FROM tmp_projects);
DELETE FROM "Client" WHERE id IN (SELECT id FROM tmp_clients);
DELETE FROM "Vendor" WHERE id IN (SELECT id FROM tmp_vendors);
DELETE FROM "InventoryItem" WHERE id IN (SELECT id FROM tmp_items);
DELETE FROM "CompanyAccount" WHERE id IN (SELECT id FROM tmp_accounts);

-- Re-sync employee wallet snapshot to latest wallet ledger after cleanup.
WITH latest AS (
  SELECT DISTINCT ON ("employeeId") "employeeId", balance
  FROM "WalletLedger"
  ORDER BY "employeeId", date DESC, "createdAt" DESC
)
UPDATE "Employee" e
SET "walletBalance" = COALESCE(l.balance, 0)
FROM latest l
WHERE e.id = l."employeeId"
  AND ABS(e."walletBalance" - COALESCE(l.balance, 0)) > 0.01;

COMMIT;
SQL

read -r -d '' VERIFY_SQL <<'SQL' || true
SELECT 'projects' AS entity, count(*) AS rows FROM "Project"
WHERE "projectId" ILIKE 'PRJ-E2E-%' OR "projectId" ILIKE 'SMOKE-%' OR "projectId" ILIKE 'STAGING-%' OR name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%'
UNION ALL
SELECT 'clients', count(*) FROM "Client" WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%'
UNION ALL
SELECT 'vendors', count(*) FROM "Vendor" WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%' OR name ILIKE '%PLAYWRIGHT%'
UNION ALL
SELECT 'items', count(*) FROM "InventoryItem" WHERE name ILIKE '%E2E%' OR COALESCE(sku,'') ILIKE '%E2E%' OR category ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%'
UNION ALL
SELECT 'expenses', count(*) FROM "Expense" WHERE description ILIKE '%E2E%' OR description ILIKE '%SMOKE%' OR description ILIKE '%STAGING%' OR description ILIKE 'MOBILE_EXP_SMOKE_%'
UNION ALL
SELECT 'incomes', count(*) FROM "Income" WHERE source ILIKE '%E2E%' OR source ILIKE '%SMOKE%' OR source ILIKE '%STAGING%'
UNION ALL
SELECT 'vendor_bills', count(*) FROM "VendorBill" WHERE "billNumber" ILIKE '%E2E%' OR "billNumber" ILIKE '%SMOKE%' OR "billNumber" ILIKE '%STAGING%'
UNION ALL
SELECT 'vendor_payments', count(*) FROM "VendorPayment" WHERE "paymentNumber" ILIKE '%E2E%' OR "paymentNumber" ILIKE '%SMOKE%' OR "paymentNumber" ILIKE '%STAGING%'
UNION ALL
SELECT 'company_accounts', count(*) FROM "CompanyAccount" WHERE name ILIKE '%E2E%' OR name ILIKE '%SMOKE%' OR name ILIKE '%STAGING%'
ORDER BY entity;
SQL

ssh "${SSH_TARGET}" "APP_DIR='${APP_DIR}' bash -s" <<EOF | tee -a "${LOG_FILE}"
set -euo pipefail
cd "\${APP_DIR}"
RAW_URL=\$(awk -F= '/^DATABASE_URL=/{print substr(\$0,index(\$0,\$2)); exit}' .env | tr -d '"')
DB_URL="\${RAW_URL%%\?*}"

echo "=== PREVIEW ==="
psql "\${DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
${PREVIEW_SQL}
SQL

if [ "${MODE}" = "execute" ]; then
  echo "=== EXECUTE CLEANUP ==="
  psql "\${DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
${DELETE_SQL}
SQL
  echo "=== VERIFY AFTER CLEANUP ==="
  psql "\${DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
${VERIFY_SQL}
SQL
fi
EOF

echo "Cleanup log written to ${LOG_FILE}" | tee -a "${LOG_FILE}"
