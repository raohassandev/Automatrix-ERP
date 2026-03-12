-- Payroll disbursement metadata on payroll entries
ALTER TABLE "PayrollEntry"
  ADD COLUMN IF NOT EXISTS "paidById" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentMode" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollEntry_paidById_fkey'
  ) THEN
    ALTER TABLE "PayrollEntry"
      ADD CONSTRAINT "PayrollEntry_paidById_fkey"
      FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayrollEntry_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "PayrollEntry"
      ADD CONSTRAINT "PayrollEntry_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "PayrollEntry_paidById_idx" ON "PayrollEntry"("paidById");
CREATE INDEX IF NOT EXISTS "PayrollEntry_companyAccountId_idx" ON "PayrollEntry"("companyAccountId");

-- Salary advance lifecycle + recovery tracking
ALTER TABLE "SalaryAdvance"
  ADD COLUMN IF NOT EXISTS "issuedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recoveredAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "outstandingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recoveryMode" TEXT NOT NULL DEFAULT 'FULL_NEXT_PAYROLL',
  ADD COLUMN IF NOT EXISTS "installmentAmount" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- Backfill lifecycle amounts for existing rows.
UPDATE "SalaryAdvance"
SET
  "issuedAmount" = CASE
    WHEN "issuedAmount" = 0 THEN COALESCE("amount", 0)
    ELSE "issuedAmount"
  END,
  "outstandingAmount" = CASE
    WHEN "outstandingAmount" = 0 THEN GREATEST(
      (
        CASE
          WHEN "issuedAmount" = 0 THEN COALESCE("amount", 0)
          ELSE "issuedAmount"
        END
      ) - COALESCE("recoveredAmount", 0),
      0
    )
    ELSE "outstandingAmount"
  END;

CREATE TABLE IF NOT EXISTS "SalaryAdvanceRecovery" (
  "id" TEXT NOT NULL,
  "salaryAdvanceId" TEXT NOT NULL,
  "payrollEntryId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "note" TEXT,
  "postedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalaryAdvanceRecovery_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalaryAdvanceRecovery_salaryAdvanceId_fkey'
  ) THEN
    ALTER TABLE "SalaryAdvanceRecovery"
      ADD CONSTRAINT "SalaryAdvanceRecovery_salaryAdvanceId_fkey"
      FOREIGN KEY ("salaryAdvanceId") REFERENCES "SalaryAdvance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalaryAdvanceRecovery_payrollEntryId_fkey'
  ) THEN
    ALTER TABLE "SalaryAdvanceRecovery"
      ADD CONSTRAINT "SalaryAdvanceRecovery_payrollEntryId_fkey"
      FOREIGN KEY ("payrollEntryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalaryAdvanceRecovery_postedById_fkey'
  ) THEN
    ALTER TABLE "SalaryAdvanceRecovery"
      ADD CONSTRAINT "SalaryAdvanceRecovery_postedById_fkey"
      FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "SalaryAdvanceRecovery_salaryAdvanceId_createdAt_idx"
  ON "SalaryAdvanceRecovery"("salaryAdvanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "SalaryAdvanceRecovery_payrollEntryId_idx"
  ON "SalaryAdvanceRecovery"("payrollEntryId");
