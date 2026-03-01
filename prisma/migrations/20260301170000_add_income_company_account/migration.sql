-- AlterTable
ALTER TABLE "Income" ADD COLUMN "companyAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Income_companyAccountId_idx" ON "Income"("companyAccountId");

-- AddForeignKey
ALTER TABLE "Income"
ADD CONSTRAINT "Income_companyAccountId_fkey"
FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
