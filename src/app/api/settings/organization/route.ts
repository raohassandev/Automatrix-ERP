import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(200).optional(),
  currency: z.string().trim().min(3).max(10).default("PKR"),
  timezone: z.string().trim().min(1).max(120).default("Asia/Karachi"),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(7),
  defaultCustomerTermsDays: z.number().int().min(0).max(365).default(30),
  defaultVendorTermsDays: z.number().int().min(0).max(365).default(30),
  expenseReceiptThreshold: z.number().nonnegative().default(0),
});

async function canManageSettings(userId: string) {
  return (
    (await requirePermission(userId, "employees.view_all")) ||
    (await requirePermission(userId, "company_accounts.manage"))
  );
}

type OrganizationSettingsRecord = {
  id: string;
  companyName: string;
  legalName: string | null;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  defaultCustomerTermsDays: number;
  defaultVendorTermsDays: number;
  expenseReceiptThreshold: number;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const organizationSettingClient = prisma as unknown as {
  organizationSetting: {
    findFirst: (args?: unknown) => Promise<OrganizationSettingsRecord | null>;
    update: (args: unknown) => Promise<OrganizationSettingsRecord>;
    create: (args: unknown) => Promise<OrganizationSettingsRecord>;
  };
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const row = await organizationSettingClient.organizationSetting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!row) {
    return NextResponse.json({
      success: true,
      data: {
        companyName: "AutoMatrix ERP",
        legalName: "",
        currency: "PKR",
        timezone: "Asia/Karachi",
        fiscalYearStartMonth: 7,
        defaultCustomerTermsDays: 30,
        defaultVendorTermsDays: 30,
        expenseReceiptThreshold: 0,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...row,
      expenseReceiptThreshold: Number(row.expenseReceiptThreshold || 0),
    },
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageSettings(session.user.id);
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await organizationSettingClient.organizationSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const saved = existing
    ? await organizationSettingClient.organizationSetting.update({
        where: { id: existing.id },
        data: {
          ...parsed.data,
          legalName: parsed.data.legalName || null,
          expenseReceiptThreshold: parsed.data.expenseReceiptThreshold,
          updatedById: session.user.id,
        },
      })
    : await organizationSettingClient.organizationSetting.create({
        data: {
          ...parsed.data,
          legalName: parsed.data.legalName || null,
          expenseReceiptThreshold: parsed.data.expenseReceiptThreshold,
          updatedById: session.user.id,
        },
      });

  await logAudit({
    action: "UPDATE_ORGANIZATION_SETTINGS",
    entity: "OrganizationSetting",
    entityId: saved.id,
    userId: session.user.id,
    newValue: JSON.stringify(parsed.data),
  });

  return NextResponse.json({
    success: true,
    data: {
      ...saved,
      expenseReceiptThreshold: Number(saved.expenseReceiptThreshold || 0),
    },
  });
}
