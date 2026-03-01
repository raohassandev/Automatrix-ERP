import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const canView = await requirePermission(session.user.id, "accounting.view");
  if (!canView) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const journal = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          glAccount: { select: { id: true, code: true, name: true, type: true } },
          project: { select: { id: true, projectId: true, name: true } },
          employee: { select: { id: true, name: true, email: true } },
        },
      },
      fiscalPeriod: { select: { id: true, code: true, status: true } },
      batch: { select: { id: true, sourceType: true, sourceId: true, status: true } },
    },
  });

  if (!journal) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const debit = journal.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const credit = journal.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  return NextResponse.json({
    success: true,
    data: {
      ...journal,
      debit,
      credit,
      balanced: Math.abs(debit - credit) <= 0.01,
    },
  });
}
