-- CreateTable
CREATE TABLE "OrganizationSetting" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 7,
    "defaultCustomerTermsDays" INTEGER NOT NULL DEFAULT 30,
    "defaultVendorTermsDays" INTEGER NOT NULL DEFAULT 30,
    "expenseReceiptThreshold" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSetting_pkey" PRIMARY KEY ("id")
);
