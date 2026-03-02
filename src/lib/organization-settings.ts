import { prisma } from "@/lib/prisma";

export type OrganizationDefaults = {
  companyName: string;
  legalName: string;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  defaultCustomerTermsDays: number;
  defaultVendorTermsDays: number;
  expenseReceiptThreshold: number;
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationDefaults = {
  companyName: "AutoMatrix ERP",
  legalName: "",
  currency: "PKR",
  timezone: "Asia/Karachi",
  fiscalYearStartMonth: 7,
  defaultCustomerTermsDays: 30,
  defaultVendorTermsDays: 30,
  expenseReceiptThreshold: 0,
};

export async function getOrganizationDefaults(): Promise<OrganizationDefaults> {
  const settings = await (prisma as unknown as {
    organizationSetting?: {
      findFirst: (args?: unknown) => Promise<{
        companyName: string;
        legalName: string | null;
        currency: string;
        timezone: string;
        fiscalYearStartMonth: number;
        defaultCustomerTermsDays: number;
        defaultVendorTermsDays: number;
        expenseReceiptThreshold: unknown;
      } | null>;
    };
  }).organizationSetting?.findFirst?.({
    orderBy: { createdAt: "asc" },
  });

  if (!settings) {
    return DEFAULT_ORGANIZATION_SETTINGS;
  }

  return {
    companyName: settings.companyName || DEFAULT_ORGANIZATION_SETTINGS.companyName,
    legalName: settings.legalName || "",
    currency: settings.currency || DEFAULT_ORGANIZATION_SETTINGS.currency,
    timezone: settings.timezone || DEFAULT_ORGANIZATION_SETTINGS.timezone,
    fiscalYearStartMonth:
      Number(settings.fiscalYearStartMonth || DEFAULT_ORGANIZATION_SETTINGS.fiscalYearStartMonth),
    defaultCustomerTermsDays: Number(
      settings.defaultCustomerTermsDays || DEFAULT_ORGANIZATION_SETTINGS.defaultCustomerTermsDays,
    ),
    defaultVendorTermsDays: Number(
      settings.defaultVendorTermsDays || DEFAULT_ORGANIZATION_SETTINGS.defaultVendorTermsDays,
    ),
    expenseReceiptThreshold: Number(settings.expenseReceiptThreshold || 0),
  };
}
