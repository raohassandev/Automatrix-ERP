-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('EMPLOYEE_WALLET', 'COMPANY_DIRECT', 'COMPANY_ACCOUNT');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paymentSource" "PaymentSource" NOT NULL DEFAULT 'COMPANY_DIRECT',
ADD COLUMN     "walletLedgerId" TEXT;
