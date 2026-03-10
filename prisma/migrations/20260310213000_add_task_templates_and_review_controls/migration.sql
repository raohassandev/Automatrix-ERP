-- Add review + recurrence metadata to project tasks
ALTER TABLE "ProjectTask"
ADD COLUMN "templateId" TEXT,
ADD COLUMN "instanceDate" TIMESTAMP(3),
ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "reviewScore" INTEGER,
ADD COLUMN "reviewNotes" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT;

-- Recurring task templates
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "intervalType" TEXT NOT NULL,
    "intervalValue" INTEGER NOT NULL DEFAULT 1,
    "weekdays" TEXT,
    "dayOfMonth" INTEGER,
    "dueAfterDays" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectTask_templateId_instanceDate_idx" ON "ProjectTask"("templateId", "instanceDate");
CREATE INDEX "ProjectTask_reviewedById_reviewedAt_idx" ON "ProjectTask"("reviewedById", "reviewedAt");
CREATE UNIQUE INDEX "ProjectTask_templateId_instanceDate_key" ON "ProjectTask"("templateId", "instanceDate");
CREATE INDEX "TaskTemplate_projectId_isActive_idx" ON "TaskTemplate"("projectId", "isActive");
CREATE INDEX "TaskTemplate_assignedToId_isActive_idx" ON "TaskTemplate"("assignedToId", "isActive");
CREATE INDEX "TaskTemplate_nextRunAt_isActive_idx" ON "TaskTemplate"("nextRunAt", "isActive");

ALTER TABLE "ProjectTask"
ADD CONSTRAINT "ProjectTask_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectTask"
ADD CONSTRAINT "ProjectTask_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskTemplate"
ADD CONSTRAINT "TaskTemplate_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskTemplate"
ADD CONSTRAINT "TaskTemplate_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskTemplate"
ADD CONSTRAINT "TaskTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
