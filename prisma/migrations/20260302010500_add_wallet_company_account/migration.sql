ALTER TABLE "WalletLedger"
ADD COLUMN "companyAccountId" TEXT;

CREATE INDEX "WalletLedger_companyAccountId_idx" ON "WalletLedger"("companyAccountId");

ALTER TABLE "WalletLedger"
ADD CONSTRAINT "WalletLedger_companyAccountId_fkey"
FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
