import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "income.view_all");
  const canViewOwn = await requirePermission(session.user.id, "income.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const incomeSources = await prisma.income.findMany({
    where: canViewAll ? {} : { addedById: session.user.id },
    select: {
      source: true,
    },
    distinct: ['source'],
    orderBy: {
      source: 'asc',
    },
  });

  return NextResponse.json({ success: true, data: incomeSources.map((s) => s.source) });
}
