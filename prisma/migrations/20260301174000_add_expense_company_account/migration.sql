-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "companyAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_companyAccountId_idx" ON "Expense"("companyAccountId");

-- AddForeignKey
ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_companyAccountId_fkey"
FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
