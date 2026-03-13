ALTER TABLE "IncentiveEntry"
  ADD COLUMN IF NOT EXISTS "earningDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduledPayrollMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settledMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE "CommissionEntry"
  ADD COLUMN IF NOT EXISTS "earningDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduledPayrollMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settledMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

UPDATE "IncentiveEntry"
SET
  "earningDate" = COALESCE("earningDate", "createdAt"),
  "approvedAt" = CASE WHEN UPPER(COALESCE("status", '')) = 'APPROVED' THEN COALESCE("approvedAt", "updatedAt") ELSE "approvedAt" END,
  "scheduledPayrollMonth" = CASE
    WHEN UPPER(COALESCE("payoutMode", 'PAYROLL')) = 'PAYROLL' AND "scheduledPayrollMonth" IS NULL
      THEN to_char(COALESCE("earningDate", "createdAt"), 'YYYY-MM')
    ELSE "scheduledPayrollMonth"
  END,
  "settledMonth" = CASE
    WHEN "settledAt" IS NOT NULL AND "settledMonth" IS NULL THEN to_char("settledAt", 'YYYY-MM')
    ELSE "settledMonth"
  END;

UPDATE "CommissionEntry"
SET
  "earningDate" = COALESCE("earningDate", "createdAt"),
  "approvedAt" = CASE WHEN UPPER(COALESCE("status", '')) = 'APPROVED' THEN COALESCE("approvedAt", "updatedAt") ELSE "approvedAt" END,
  "scheduledPayrollMonth" = CASE
    WHEN UPPER(COALESCE("payoutMode", 'PAYROLL')) = 'PAYROLL' AND "scheduledPayrollMonth" IS NULL
      THEN to_char(COALESCE("earningDate", "createdAt"), 'YYYY-MM')
    ELSE "scheduledPayrollMonth"
  END,
  "settledMonth" = CASE
    WHEN "settledAt" IS NOT NULL AND "settledMonth" IS NULL THEN to_char("settledAt", 'YYYY-MM')
    ELSE "settledMonth"
  END;
