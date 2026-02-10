import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const companyAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["CASH", "BANK"]),
  currency: z.string().trim().min(1).default("PKR"),
  openingBalance: z.number().finite().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView =
    (await requirePermission(session.user.id, "company_accounts.view")) ||
    (await requirePermission(session.user.id, "company_accounts.manage"));
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.companyAccount.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = companyAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.companyAccount.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        currency: parsed.data.currency,
        openingBalance: typeof parsed.data.openingBalance === "number" ? parsed.data.openingBalance : 0,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await logAudit({
      action: "CREATE_COMPANY_ACCOUNT",
      entity: "CompanyAccount",
      entityId: created.id,
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Account name already exists" }, { status: 400 });
    }
    console.error("Error creating company account:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

