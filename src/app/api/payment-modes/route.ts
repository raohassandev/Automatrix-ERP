import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

const DEFAULT_PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "Online Transfer", "Credit Card", "Other"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  const canSubmit = await requirePermission(session.user.id, "expenses.submit");
  if (!canViewAll && !canViewOwn && !canSubmit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const paymentModes = await prisma.expense.findMany({
    where: canViewAll ? {} : { submittedById: session.user.id },
    select: {
      paymentMode: true,
    },
    distinct: ['paymentMode'],
    orderBy: {
      paymentMode: 'asc',
    },
  });

  const normalized = paymentModes
    .map((pm) => (pm.paymentMode || "").trim())
    .filter((mode) => mode.length > 0);

  // Always return baseline choices so first-time users can submit expenses.
  const merged = Array.from(new Set([...normalized, ...DEFAULT_PAYMENT_MODES])).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ success: true, data: merged });
}
