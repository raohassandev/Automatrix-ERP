import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  if (!canViewAll && !canViewOwn) {
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

  return NextResponse.json({ success: true, data: paymentModes.map((pm) => pm.paymentMode) });
}
