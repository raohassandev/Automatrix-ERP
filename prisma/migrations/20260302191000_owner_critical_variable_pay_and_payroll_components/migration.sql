-- Incentive payout + settlement tracking
ALTER TABLE "IncentiveEntry"
ADD COLUMN "formulaType" TEXT,
ADD COLUMN "basisAmount" DECIMAL(65,30),
ADD COLUMN "percent" DECIMAL(65,30),
ADD COLUMN "payoutMode" TEXT NOT NULL DEFAULT 'PAYROLL',
ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'UNSETTLED',
ADD COLUMN "settledInPayrollRunId" TEXT,
ADD COLUMN "settledInPayrollEntryId" TEXT,
ADD COLUMN "settledAt" TIMESTAMP(3);

-- Commission support for employee + middleman with settlement tracking
ALTER TABLE "CommissionEntry"
ALTER COLUMN "employeeId" DROP NOT NULL;

ALTER TABLE "CommissionEntry"
ADD COLUMN "vendorId" TEXT,
ADD COLUMN "payeeType" TEXT NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN "payoutMode" TEXT NOT NULL DEFAULT 'PAYROLL',
ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'UNSETTLED',
ADD COLUMN "settledInPayrollRunId" TEXT,
ADD COLUMN "settledInPayrollEntryId" TEXT,
ADD COLUMN "payableBillId" TEXT,
ADD COLUMN "settledAt" TIMESTAMP(3);

-- Payroll component breakdown for salary slips and audit traceability
CREATE TABLE "PayrollComponentLine" (
    "id" TEXT NOT NULL,
    "payrollEntryId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "projectRef" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollComponentLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollComponentLine_payrollEntryId_idx" ON "PayrollComponentLine"("payrollEntryId");
CREATE INDEX "PayrollComponentLine_sourceType_sourceId_idx" ON "PayrollComponentLine"("sourceType", "sourceId");
CREATE INDEX "CommissionEntry_vendorId_idx" ON "CommissionEntry"("vendorId");

ALTER TABLE "PayrollComponentLine"
ADD CONSTRAINT "PayrollComponentLine_payrollEntryId_fkey"
FOREIGN KEY ("payrollEntryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommissionEntry"
ADD CONSTRAINT "CommissionEntry_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
