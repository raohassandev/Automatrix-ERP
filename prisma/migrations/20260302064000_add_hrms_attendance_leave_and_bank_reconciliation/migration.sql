-- CreateTable
CREATE TABLE "AttendanceEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL DEFAULT 'ANNUAL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliationSnapshot" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "bookBalance" DECIMAL(65,30) NOT NULL,
    "statementBalance" DECIMAL(65,30) NOT NULL,
    "difference" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNRECONCILED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEntry_employeeId_date_key" ON "AttendanceEntry"("employeeId", "date");

-- CreateIndex
CREATE INDEX "AttendanceEntry_date_status_idx" ON "AttendanceEntry"("date", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "BankReconciliationSnapshot_companyAccountId_asOfDate_idx" ON "BankReconciliationSnapshot"("companyAccountId", "asOfDate");

-- AddForeignKey
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationSnapshot" ADD CONSTRAINT "BankReconciliationSnapshot_companyAccountId_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationSnapshot" ADD CONSTRAINT "BankReconciliationSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
