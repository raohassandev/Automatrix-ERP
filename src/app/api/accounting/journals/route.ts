import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const canView = await requirePermission(session.user.id, "accounting.view");
  if (!canView) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const status = (searchParams.get("status") || "").trim().toUpperCase();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const take = Math.min(Math.max(parseInt(searchParams.get("take") || "25", 10), 1), 100);
  const skip = (page - 1) * take;

  const where: import("@prisma/client").Prisma.JournalEntryWhereInput = {};
  if (search) {
    where.OR = [
      { voucherNo: { contains: search, mode: "insensitive" } },
      { memo: { contains: search, mode: "insensitive" } },
      { sourceType: { contains: search, mode: "insensitive" } },
      { sourceId: { contains: search, mode: "insensitive" } },
    ];
  }
  if (["DRAFT", "POSTED", "REVERSED"].includes(status)) where.status = status;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.postingDate = range;
  }

  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        lines: { select: { debit: true, credit: true } },
      },
    }),
    prisma.journalEntry.count({ where }),
  ]);

  const data = rows.map((j) => {
    const debit = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const credit = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    return {
      id: j.id,
      voucherNo: j.voucherNo,
      documentDate: j.documentDate,
      postingDate: j.postingDate,
      status: j.status,
      sourceType: j.sourceType,
      sourceId: j.sourceId,
      memo: j.memo,
      debit,
      credit,
      lineCount: j.lines.length,
      createdAt: j.createdAt,
    };
  });

  return NextResponse.json({
    success: true,
    data,
    page,
    take,
    total,
    totalPages: Math.max(1, Math.ceil(total / take)),
  });
}
