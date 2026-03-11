import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { expenseSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/rbac';
import { DUPLICATE_CHECK_DAYS, PROCUREMENT_SPIKE_THRESHOLD } from '@/lib/constants';
import { getExpenseApprovalLevel } from '@/lib/approvals';
import { createNotification } from '@/lib/notifications';
import { Prisma } from '@prisma/client';
import { sanitizeString } from '@/lib/sanitize';
import { recalculateProjectFinancials, resolveProjectDbId, resolveProjectId } from '@/lib/projects';
import { postExpenseApprovalJournal } from '@/lib/accounting';
import { getOrganizationDefaults } from '@/lib/organization-settings';

const STOCK_KEYS_BLOCKED_IN_EXPENSES = [
  "addToInventory",
  "inventoryItemId",
  "inventoryQuantity",
  "inventoryUnitCost",
] as const;

async function checkDuplicateExpense(input: { amount: number; description: string; date: string }) {
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
    match.description.toLowerCase().includes(descriptionLower.slice(0, 20)),
  );
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, 'expenses.view_all');
  const canViewOwn = await requirePermission(session.user.id, 'expenses.view_own');

  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
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
    const where: Prisma.ExpenseWhereInput = {};

    // Check if user can view all expenses or only their own
    if (!canViewAll) {
      where.submittedById = session.user.id;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' as const } },
        { category: { contains: search, mode: 'insensitive' as const } },
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
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.ExpenseOrderByWithRelationInput = {
      [sortBy]: orderDirection,
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          submittedBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          companyAccount: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    // Convert Decimal to number for JSON serialization
    const serializedExpenses = expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      approvedAmount: expense.approvedAmount ? Number(expense.approvedAmount) : null,
      companyAccountName: expense.companyAccount?.name || null,
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
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const canSubmit = await requirePermission(session.user.id, 'expenses.submit');
    if (!canSubmit) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    // Phase 1 (SUPER_MASTER_PLAN): expenses are non-stock only.
    // Stock purchases must go through PO -> GRN -> Vendor Bill -> Vendor Payment.
    for (const key of STOCK_KEYS_BLOCKED_IN_EXPENSES) {
      if (key in body && body[key] != null && body[key] !== false && body[key] !== "") {
        await logAudit({
          action: "BLOCK_EXPENSE_STOCK_PAYLOAD",
          entity: "Expense",
          entityId: "NEW",
          reason: `Blocked stock payload key: ${key}`,
          newValue: JSON.stringify({ key, value: body[key] }),
          userId: session.user.id,
        });
        return NextResponse.json(
          {
            success: false,
            error:
              "Stock purchases are not allowed in Expenses (Phase 1). Use Procurement -> PO/GRN/Vendor Bill.",
          },
          { status: 400 },
        );
      }
    }
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Sanitize string inputs after validation
    const sanitizedData = {
      ...parsed.data,
      description: sanitizeString(parsed.data.description),
      category: sanitizeString(parsed.data.category),
      paymentMode: sanitizeString(parsed.data.paymentMode),
      companyAccountId: parsed.data.companyAccountId
        ? sanitizeString(parsed.data.companyAccountId)
        : undefined,
      project: parsed.data.project ? sanitizeString(parsed.data.project) : undefined,
      receiptUrl: parsed.data.receiptUrl ? sanitizeString(parsed.data.receiptUrl) : undefined,
      receiptFileId: parsed.data.receiptFileId
        ? sanitizeString(parsed.data.receiptFileId)
        : undefined,
      remarks: parsed.data.remarks ? sanitizeString(parsed.data.remarks) : undefined,
      categoryRequest: parsed.data.categoryRequest
        ? sanitizeString(parsed.data.categoryRequest)
        : undefined,
    };
    const expenseType = parsed.data.expenseType || 'COMPANY';

    const category = await prisma.category.findFirst({
      where: { name: sanitizedData.category, type: 'expense' },
    });
    if (category?.enforceStrict && category.maxAmount) {
      if (sanitizedData.amount > Number(category.maxAmount)) {
        return NextResponse.json(
          {
            success: false,
            error: `Amount exceeds allowed limit for ${sanitizedData.category} (max ${category.maxAmount}).`,
          },
          { status: 400 },
        );
      }
    }

    const orgDefaults = await getOrganizationDefaults();
    if (
      sanitizedData.amount >= Number(orgDefaults.expenseReceiptThreshold || 0) &&
      Number(orgDefaults.expenseReceiptThreshold || 0) > 0 &&
      !sanitizedData.receiptUrl &&
      !sanitizedData.receiptFileId
    ) {
      await logAudit({
        action: "BLOCK_EXPENSE_MISSING_RECEIPT",
        entity: "Expense",
        entityId: "NEW",
        reason: `Receipt required for amounts >= ${orgDefaults.expenseReceiptThreshold}`,
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Receipt is required for expenses of PKR ${Number(orgDefaults.expenseReceiptThreshold).toLocaleString()} or above.`,
        },
        { status: 400 },
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
          (dup) => dup.submittedById === session.user.id,
        );

        if (sameUserDuplicates.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'Possible duplicate expense detected (your previous entries)',
              duplicates: sameUserDuplicates.map((dup) => ({
                id: dup.id,
                date: dup.date,
                description: dup.description,
                amount: Number(dup.amount),
                status: dup.status,
              })),
              requiresConfirmation: true,
            },
            { status: 409 },
          );
        }

        return NextResponse.json(
          {
            success: false,
            error: 'A similar expense already exists (submitted by another user).',
            requiresConfirmation: false,
          },
          { status: 409 },
        );
      }
    }

    let resolvedProjectRef: string | null = null;
    let resolvedProjectDbId: string | null = null;
    if (sanitizedData.project) {
      resolvedProjectRef = await resolveProjectId(sanitizedData.project);
      resolvedProjectDbId = await resolveProjectDbId(sanitizedData.project);
      if (!resolvedProjectRef || !resolvedProjectDbId) {
        return NextResponse.json(
          { success: false, error: 'Invalid project reference' },
          { status: 400 },
        );
      }

      // Phase 1 RBAC scope: non-global users can submit only against assigned projects.
      const canViewAllProjects = await requirePermission(session.user.id, 'projects.view_all');
      if (!canViewAllProjects) {
        const canViewAssignedProjects = await requirePermission(session.user.id, 'projects.view_assigned');
        if (!canViewAssignedProjects) {
          return NextResponse.json(
            { success: false, error: 'Project access denied for this expense' },
            { status: 403 },
          );
        }
        const assigned = await prisma.projectAssignment.findFirst({
          where: { projectId: resolvedProjectDbId, userId: session.user.id },
          select: { id: true },
        });
        if (!assigned) {
          await logAudit({
            action: 'BLOCK_EXPENSE_PROJECT_SCOPE',
            entity: 'Expense',
            entityId: 'NEW',
            reason: 'User attempted to submit expense for unassigned project',
            newValue: JSON.stringify({ projectRef: resolvedProjectRef, projectId: resolvedProjectDbId }),
            userId: session.user.id,
          });
          return NextResponse.json(
            { success: false, error: 'You are not assigned to the selected project' },
            { status: 403 },
          );
        }
      }
    }

    const approvalLevel = getExpenseApprovalLevel(sanitizedData.amount);
    let status =
      approvalLevel === 'L1' ? 'PENDING_L1' : approvalLevel === 'L2' ? 'PENDING_L2' : 'PENDING_L3';
    let approvedById: string | null = null;
    let approvedAmount: number | null = null;

    // Payment source governs accounting and payout lifecycle.
    const paymentSource = sanitizedData.paymentSource || 'COMPANY_DIRECT';
    let resolvedCompanyAccountId: string | null = null;

    // Owner personal expenses auto-approve and cannot use employee wallet.
    // If employee paid from own pocket, keep as APPROVED (payable) until reimbursement.
    if (expenseType === 'OWNER_PERSONAL') {
      status = paymentSource === "EMPLOYEE_POCKET" ? "APPROVED" : "PAID";
      approvedById = session.user.id;
      approvedAmount = sanitizedData.amount;
      if (paymentSource === 'EMPLOYEE_WALLET') {
        return NextResponse.json(
          { success: false, error: 'Owner personal expenses cannot be paid from employee wallet' },
          { status: 400 },
        );
      }
    }

    if (paymentSource === 'COMPANY_ACCOUNT') {
      if (!sanitizedData.companyAccountId) {
        return NextResponse.json(
          { success: false, error: 'Company account is required when payment source is COMPANY_ACCOUNT' },
          { status: 400 },
        );
      }
      const account = await prisma.companyAccount.findUnique({
        where: { id: sanitizedData.companyAccountId },
        select: { id: true, isActive: true },
      });
      if (!account || !account.isActive) {
        return NextResponse.json(
          { success: false, error: 'Invalid or inactive company account' },
          { status: 400 },
        );
      }
      resolvedCompanyAccountId = account.id;
    }
    const requiresEmployeeWalletContext =
      paymentSource === "EMPLOYEE_WALLET" || paymentSource === "EMPLOYEE_POCKET";
    let employeeRecord: {
      id: string;
      walletBalance: Prisma.Decimal;
      walletHold: Prisma.Decimal;
    } | null = null;
    let availableAdvance = 0;
    if (requiresEmployeeWalletContext) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });

      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 400 });
      }

      employeeRecord = await prisma.employee.findUnique({
        where: { email: user.email },
        select: { id: true, walletBalance: true, walletHold: true },
      });

      if (!employeeRecord) {
        return NextResponse.json(
          { success: false, error: 'Employee record not found. Cannot use this payment source.' },
          { status: 400 },
        );
      }
      availableAdvance = Number(employeeRecord.walletBalance) - Number(employeeRecord.walletHold || 0);
    }

    if (paymentSource === 'EMPLOYEE_WALLET') {
      if (availableAdvance < sanitizedData.amount) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient available wallet balance. Available: ${availableAdvance}, Required: ${sanitizedData.amount}`,
          },
          { status: 400 },
        );
      }
    }
    if (paymentSource === "EMPLOYEE_POCKET" && availableAdvance > 0) {
      await logAudit({
        action: "BLOCK_EXPENSE_OWN_POCKET_WITH_ADVANCE",
        entity: "Expense",
        entityId: "NEW",
        reason: `Blocked own-pocket expense while available advance exists: ${availableAdvance}`,
        userId: session.user.id,
        newValue: JSON.stringify({
          paymentSource,
          availableAdvance,
          amount: sanitizedData.amount,
        }),
      });
      return NextResponse.json(
        {
          success: false,
          error: `You still have company advance available (PKR ${availableAdvance.toLocaleString()}). Use Employee Wallet for advance-funded spending or settle/clear advance first.`,
        },
        { status: 400 },
      );
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
          paymentSource: paymentSource as 'EMPLOYEE_WALLET' | 'EMPLOYEE_POCKET' | 'COMPANY_DIRECT' | 'COMPANY_ACCOUNT',
          companyAccountId: resolvedCompanyAccountId || undefined,
          expenseType,
          project: resolvedProjectRef,
          approvalLevel,
          status,
          submittedById: session.user.id,
          approvedById,
          approvedAmount: approvedAmount !== null ? new Prisma.Decimal(approvedAmount) : undefined,
          receiptUrl: sanitizedData.receiptUrl,
          receiptFileId: sanitizedData.receiptFileId,
          remarks: sanitizedData.remarks,
          categoryRequest: sanitizedData.categoryRequest,
        },
      });

      // If paid from wallet, deduct the amount
      if (paymentSource === 'EMPLOYEE_WALLET' && employeeRecord) {
        await tx.employee.update({
          where: { id: employeeRecord.id },
          data: {
            walletHold: new Prisma.Decimal(
              Number(employeeRecord.walletHold) + sanitizedData.amount,
            ),
          },
        });
      }

      if (status === 'APPROVED' || status === 'PARTIALLY_APPROVED' || status === 'PAID') {
        const amountToPost = approvedAmount !== null ? approvedAmount : sanitizedData.amount;
        await postExpenseApprovalJournal(tx, {
          expenseId: created.id,
          amount: amountToPost,
          expenseDate: created.date,
          paymentSource,
          companyAccountId: resolvedCompanyAccountId,
          projectRef: resolvedProjectRef,
          userId: session.user.id,
          memo: 'Expense auto-approval posting',
        });
      }

      return { created };
    });

    await logAudit({
      action: 'SUBMIT_EXPENSE',
      entity: 'Expense',
      entityId: result.created.id,
      newValue: JSON.stringify(sanitizedData),
      userId: session.user.id,
    });

    await createNotification({
      userId: session.user.id,
      type: 'EXPENSE_SUBMITTED',
      message:
        paymentSource === "EMPLOYEE_WALLET"
          ? `Expense submitted for ${sanitizedData.amount} (from issued advance wallet).`
          : paymentSource === "EMPLOYEE_POCKET"
          ? `Expense submitted for ${sanitizedData.amount} (employee own pocket, reimbursement required after approval).`
          : `Expense submitted for ${sanitizedData.amount}.`,
    });

    if (sanitizedData.categoryRequest) {
      const rolesToNotify = ['Owner', 'CEO', 'Admin', 'CFO', 'Finance Manager', 'Accountant'];
      const adminUsers = await prisma.user.findMany({
        where: { role: { name: { in: rolesToNotify } } },
        select: { id: true, email: true },
      });
      await prisma.notification.createMany({
        data: adminUsers.map((user) => ({
          userId: user.id,
          type: 'CATEGORY_REQUEST',
          message: `Expense category request: "${sanitizedData.categoryRequest}" by ${session.user.email || 'user'} (category: ${sanitizedData.category}).`,
          status: 'NEW',
        })),
      });
    }

    const isMaterialCategory = /material/i.test(sanitizedData.category);
    if (isMaterialCategory && sanitizedData.amount >= PROCUREMENT_SPIKE_THRESHOLD) {
      const rolesToNotify = ['Owner', 'CEO', 'Admin', 'CFO', 'Finance Manager', 'Procurement'];
      const financeUsers = await prisma.user.findMany({
        where: { role: { name: { in: rolesToNotify } } },
        select: { id: true },
      });
      if (financeUsers.length > 0) {
        await prisma.notification.createMany({
          data: financeUsers.map((user) => ({
            userId: user.id,
            type: 'PROCUREMENT_SPEND_SPIKE',
            message: `High material expense recorded: ${sanitizedData.description} (${sanitizedData.category}, PKR ${sanitizedData.amount}). If this is a stock purchase, use Procurement -> PO/GRN/Vendor Bill.`,
            status: 'NEW',
          })),
        });
      }
    }

    if (resolvedProjectRef && ['APPROVED', 'PARTIALLY_APPROVED', 'PAID'].includes(status)) {
      await recalculateProjectFinancials(resolvedProjectRef);
    }

    return NextResponse.json({ success: true, data: result.created });
  } catch (error) {
    console.error('Expense POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: message },
      { status: 500 },
    );
  }
}
