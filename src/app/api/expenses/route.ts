import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { DUPLICATE_CHECK_DAYS, RECEIPT_REQUIRED_THRESHOLD } from "@/lib/constants";
import { getExpenseApprovalLevel } from "@/lib/approvals";
import { createNotification } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

async function checkDuplicateExpense(input: {
  amount: number;
  description: string;
  date: string;
}) {
  const date = new Date(input.date);
  const start = new Date(date);
  start.setDate(start.getDate() - DUPLICATE_CHECK_DAYS);
  const end = new Date(date);
  end.setDate(end.getDate() + DUPLICATE_CHECK_DAYS);

  const matches = await prisma.expense.findMany({
    where: {
      amount: new Prisma.Decimal(input.amount),
      date: { gte: start, lte: end },
    },
    include: {
      submittedBy: { select: { email: true, name: true } },
    },
    take: 5,
  });

  const descriptionLower = input.description.toLowerCase();
  return matches.filter((match) =>
    match.description.toLowerCase().includes(descriptionLower.slice(0, 20))
  );
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const take = 25;
  const skip = (page - 1) * take;
  const search = searchParams.get('search') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const sort = searchParams.get('sort') || undefined;
  const [sortBy, order] = sort?.split(':') || ['createdAt', 'desc'];

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const where = {
    ...(canViewAll ? {} : canViewOwn ? { submittedById: session.user.id } : { id: "__none__" }),
    AND: [
      {
        OR: search
          ? [
              { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { category: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ]
          : undefined,
      },
      {
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
    ],
  };

  const [data, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      orderBy: { [sortBy]: order },
      take,
      skip,
    }),
    prisma.expense.count({ where }),
  ]);

  return NextResponse.json({ success: true, data, total });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canSubmit = await requirePermission(session.user.id, "expenses.submit");
  if (!canSubmit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (
    parsed.data.amount >= RECEIPT_REQUIRED_THRESHOLD &&
    !parsed.data.receiptUrl &&
    !parsed.data.receiptFileId
  ) {
    return NextResponse.json(
      { success: false, error: "Receipt required for this amount" },
      { status: 400 }
    );
  }

  if (!body.ignoreDuplicate) {
    const duplicates = await checkDuplicateExpense({
      amount: parsed.data.amount,
      description: parsed.data.description,
      date: parsed.data.date,
    });

    if (duplicates.length > 0) {
      const sameUserDuplicates = duplicates.filter(
        (dup) => dup.submittedById === session.user.id
      );

      if (sameUserDuplicates.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Possible duplicate expense detected (your previous entries)",
            duplicates: sameUserDuplicates.map((dup) => ({
              id: dup.id,
              date: dup.date,
              description: dup.description,
              amount: Number(dup.amount),
              status: dup.status,
            })),
            requiresConfirmation: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "A similar expense already exists (submitted by another user).",
          requiresConfirmation: false,
        },
        { status: 409 }
      );
    }
  }

  const approvalLevel = getExpenseApprovalLevel(parsed.data.amount);
  const status =
    approvalLevel === "L1" ? "PENDING_L1" : approvalLevel === "L2" ? "PENDING_L2" : "PENDING_L3";

  const created = await prisma.expense.create({
    data: {
      date: new Date(parsed.data.date),
      description: parsed.data.description,
      category: parsed.data.category,
      amount: new Prisma.Decimal(parsed.data.amount),
      paymentMode: parsed.data.paymentMode,
      project: parsed.data.project,
      approvalLevel,
      status,
      submittedById: session.user.id,
      receiptUrl: parsed.data.receiptUrl,
      receiptFileId: parsed.data.receiptFileId,
    },
  });

  await logAudit({
    action: "SUBMIT_EXPENSE",
    entity: "Expense",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  await createNotification({
    userId: session.user.id,
    type: "EXPENSE_SUBMITTED",
    message: `Expense submitted for ${parsed.data.amount}.`,
  });

  return NextResponse.json({ success: true, data: created });
}
