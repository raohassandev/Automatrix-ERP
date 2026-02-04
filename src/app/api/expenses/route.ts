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
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

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

  const descriptionLower = sanitizeString(input.description).toLowerCase();
  return matches.filter((match) =>
    match.description.toLowerCase().includes(descriptionLower.slice(0, 20))
  );
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    const expenseType = searchParams.get('expenseType') || '';
    const paymentSource = searchParams.get('paymentSource') || '';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: {
      submittedById?: string;
      OR?: Array<{ description?: { contains: string } } | { category?: { contains: string } }>;
      category?: string;
      status?: string;
      date?: { gte?: Date; lte?: Date };
    } = {};
    
    // Check if user can view all expenses or only their own
    if (!canViewAll) {
      where.submittedById = session.user.id;
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { category: { contains: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }
    if (expenseType) {
      where.expenseType = expenseType;
    }
    if (paymentSource) {
      where.paymentSource = paymentSource;
    }

    if (from || to) {
      const range: { gte?: Date; lte?: Date } = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to);
      where.date = range;
    }

    // Build orderBy
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          submittedBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    // Convert Decimal to number for JSON serialization
    const serializedExpenses = expenses.map(expense => ({
      ...expense,
      amount: Number(expense.amount),
      approvedAmount: expense.approvedAmount ? Number(expense.approvedAmount) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        expenses: serializedExpenses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
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

  // Sanitize string inputs after validation
  const sanitizedData = {
    ...parsed.data,
    description: sanitizeString(parsed.data.description),
    category: sanitizeString(parsed.data.category),
    paymentMode: sanitizeString(parsed.data.paymentMode),
    project: parsed.data.project ? sanitizeString(parsed.data.project) : undefined,
    receiptUrl: parsed.data.receiptUrl ? sanitizeString(parsed.data.receiptUrl) : undefined,
    receiptFileId: parsed.data.receiptFileId ? sanitizeString(parsed.data.receiptFileId) : undefined,
    remarks: parsed.data.remarks ? sanitizeString(parsed.data.remarks) : undefined,
    categoryRequest: parsed.data.categoryRequest ? sanitizeString(parsed.data.categoryRequest) : undefined,
  };
  const expenseType = parsed.data.expenseType || "COMPANY";

  if (expenseType !== "OWNER_PERSONAL" && !sanitizedData.project) {
    return NextResponse.json(
      { success: false, error: "Project is required for company expenses" },
      { status: 400 }
    );
  }

  const category = await prisma.category.findFirst({
    where: { name: sanitizedData.category, type: "expense" },
  });
  if (category?.enforceStrict && category.maxAmount) {
    if (sanitizedData.amount > Number(category.maxAmount)) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount exceeds allowed limit for ${sanitizedData.category} (max ${category.maxAmount}).`,
        },
        { status: 400 }
      );
    }
  }

  if (
    sanitizedData.amount >= RECEIPT_REQUIRED_THRESHOLD &&
    !sanitizedData.receiptUrl &&
    !sanitizedData.receiptFileId
  ) {
    return NextResponse.json(
      { success: false, error: "Receipt required for this amount" },
      { status: 400 }
    );
  }

  if (!body.ignoreDuplicate) {
    const duplicates = await checkDuplicateExpense({
      amount: sanitizedData.amount,
      description: sanitizedData.description,
      date: sanitizedData.date,
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

  let resolvedProjectId: string | null = null;
  if (sanitizedData.project) {
    resolvedProjectId = await resolveProjectId(sanitizedData.project);
    if (!resolvedProjectId) {
      return NextResponse.json(
        { success: false, error: "Invalid project reference" },
        { status: 400 }
      );
    }
  }

  const approvalLevel = getExpenseApprovalLevel(sanitizedData.amount);
  const status =
    approvalLevel === "L1" ? "PENDING_L1" : approvalLevel === "L2" ? "PENDING_L2" : "PENDING_L3";

  // Check if payment source is EMPLOYEE_WALLET
  const paymentSource = sanitizedData.paymentSource || "COMPANY_DIRECT";
  let employeeRecord: { id: string; walletBalance: Prisma.Decimal; walletHold: Prisma.Decimal } | null = null;
  
  if (paymentSource === "EMPLOYEE_WALLET") {
    // Validate that user has an employee record and sufficient wallet balance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 400 }
      );
    }
    
    const employee = await prisma.employee.findUnique({
      where: { email: user.email },
      select: { id: true, walletBalance: true, walletHold: true },
    });
    
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee record not found. Cannot use wallet payment." },
        { status: 400 }
      );
    }
    
    const available = Number(employee.walletBalance) - Number(employee.walletHold || 0);
    if (available < sanitizedData.amount) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient available wallet balance. Available: ${available}, Required: ${sanitizedData.amount}` 
        },
        { status: 400 }
      );
    }

    employeeRecord = employee;
  }

  // Create expense and deduct from wallet in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        date: new Date(sanitizedData.date),
        description: sanitizedData.description,
        category: sanitizedData.category,
        amount: new Prisma.Decimal(sanitizedData.amount),
        paymentMode: sanitizedData.paymentMode,
        paymentSource: paymentSource as "EMPLOYEE_WALLET" | "COMPANY_DIRECT" | "COMPANY_ACCOUNT",
        expenseType,
        project: resolvedProjectId,
        approvalLevel,
        status,
        submittedById: session.user.id,
        receiptUrl: sanitizedData.receiptUrl,
        receiptFileId: sanitizedData.receiptFileId,
        remarks: sanitizedData.remarks,
        categoryRequest: sanitizedData.categoryRequest,
      },
    });

    // If paid from wallet, deduct the amount
    if (paymentSource === "EMPLOYEE_WALLET" && employeeRecord) {
      await tx.employee.update({
        where: { id: employeeRecord.id },
        data: {
          walletHold: new Prisma.Decimal(Number(employeeRecord.walletHold) + sanitizedData.amount),
        },
      });
    }

    return { created };
  });

  await logAudit({
    action: "SUBMIT_EXPENSE",
    entity: "Expense",
    entityId: result.created.id,
    newValue: JSON.stringify(sanitizedData),
    userId: session.user.id,
  });

  await createNotification({
    userId: session.user.id,
    type: "EXPENSE_SUBMITTED",
    message: `Expense submitted for ${sanitizedData.amount}${paymentSource === "EMPLOYEE_WALLET" ? " (paid from wallet)" : ""}.`,
  });

  if (sanitizedData.categoryRequest) {
    const rolesToNotify = ["Owner", "CEO", "Admin", "CFO", "Finance Manager", "Accountant"];
    const adminUsers = await prisma.user.findMany({
      where: { role: { name: { in: rolesToNotify } } },
      select: { id: true, email: true },
    });
    await prisma.notification.createMany({
      data: adminUsers.map((user) => ({
        userId: user.id,
        type: "CATEGORY_REQUEST",
        message: `Expense category request: "${sanitizedData.categoryRequest}" by ${session.user.email || "user"} (category: ${sanitizedData.category}).`,
        status: "NEW",
      })),
    });
  }

    return NextResponse.json({ success: true, data: result.created });
  } catch (error) {
    console.error("Expense POST error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
