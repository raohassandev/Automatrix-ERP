import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPendingApprovalsForUser,
  approveExpense,
  rejectExpense,
  approveIncome,
  rejectIncome,
  getApprovalStats,
} from "@/lib/approval-engine";
import { ZodError } from "zod";
import { approvalSchema } from "@/lib/validation-schemas";
import { logger } from "@/lib/logger";
import { userHasApprovalAssignment } from "@/lib/approval-policies";
import { requirePermission } from "@/lib/rbac";

async function canApproveWithUser(userId: string) {
  const checks = await Promise.all([
    requirePermission(userId, "expenses.approve_low"),
    requirePermission(userId, "expenses.approve_medium"),
    requirePermission(userId, "expenses.approve_high"),
    requirePermission(userId, "approvals.approve_low"),
    requirePermission(userId, "approvals.approve_high"),
    requirePermission(userId, "approvals.partial_approve"),
  ]);
  return checks.some(Boolean);
}

/**
 * GET /api/approvals - Get pending approvals for current user
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "approvals.view_all");
  const canApprove = await canApproveWithUser(session.user.id);
  const canViewPending = (await requirePermission(session.user.id, "approvals.view_pending")) || canApprove;
  const hasAssignments = await userHasApprovalAssignment(session.user.id);

  if (!canViewAll && !canViewPending && !hasAssignments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'pending' or 'stats'

    if (type === "stats") {
      if (!canViewAll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Get approval statistics
      const stats = await getApprovalStats();
      return NextResponse.json(stats);
    }

    // Get pending approvals for user
    const pendingApprovals = await getPendingApprovalsForUser(session.user.id, {
      viewAll: canViewAll,
    });

    return NextResponse.json({
      data: pendingApprovals,
      count: pendingApprovals.expenses.length + pendingApprovals.income.length,
    });
  } catch (error) {
    logger.error("Error fetching approvals", error, { userId: session.user.id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals - Approve or reject an expense
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasAssignments = await userHasApprovalAssignment(session.user.id);
  
  // Check if user has approval permissions
  if (!(await canApproveWithUser(session.user.id)) && !hasAssignments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    // Validate input
    const validated = approvalSchema.parse(body);

    if (validated.expenseId) {
      // Handle expense approval/rejection
      if (validated.action === "APPROVE" || validated.action === "PARTIAL_APPROVE") {
        const result = await approveExpense({
          expenseId: validated.expenseId,
          approverId: session.user.id,
          reason: validated.reason,
          approvedAmount: validated.approvedAmount,
        });

        return NextResponse.json({
          success: true,
          message: "Expense approved successfully",
          data: result,
        });
      } else if (validated.action === "REJECT") {
        if (!validated.reason) {
          return NextResponse.json(
            { error: "Reason is required for rejection" },
            { status: 400 }
          );
        }

        const result = await rejectExpense({
          expenseId: validated.expenseId,
          approverId: session.user.id,
          reason: validated.reason,
        });

        return NextResponse.json({
          success: true,
          message: "Expense rejected successfully",
          data: result,
        });
      }
    }

    // Handle income approval
    if (validated.incomeId || Array.isArray((body as { incomeIds?: string[] }).incomeIds)) {
      const incomeIds = validated.incomeId
        ? [validated.incomeId]
        : Array.isArray((body as { incomeIds?: string[] }).incomeIds)
          ? (body as { incomeIds: string[] }).incomeIds
          : [];

      if (incomeIds.length === 0) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }

      if (validated.action === "APPROVE" || validated.action === "PARTIAL_APPROVE") {
        const results = await Promise.all(
          incomeIds.map((incomeId) =>
            approveIncome({
              incomeId,
              approverId: session.user.id,
              reason: validated.reason,
              approvedAmount: validated.approvedAmount,
            })
          )
        );

        return NextResponse.json({
          success: true,
          message: "Income approved successfully",
          data: results,
        });
      } else if (validated.action === "REJECT") {
        const reason = validated.reason;
        if (!reason) {
          return NextResponse.json(
            { error: "Reason is required for rejection" },
            { status: 400 }
          );
        }

        const results = await Promise.all(
          incomeIds.map((incomeId) =>
            rejectIncome({
              incomeId,
              approverId: session.user.id,
              reason,
            })
          )
        );

        return NextResponse.json({
          success: true,
          message: "Income rejected successfully",
          data: results,
        });
      }
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    // Handle business logic errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.error("Error processing approval", error, { 
      userId: session.user.id,
      action: 'POST',
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/approvals - Bulk approve/reject expenses
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasAssignments = await userHasApprovalAssignment(session.user.id);
  
  if (!(await canApproveWithUser(session.user.id)) && !hasAssignments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { expenseIds, action, reason } = body;

    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      return NextResponse.json(
        { error: "expenseIds array is required" },
        { status: 400 }
      );
    }

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use APPROVE or REJECT" },
        { status: 400 }
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    // Process each expense
    for (const expenseId of expenseIds) {
      try {
        if (action === "APPROVE") {
          await approveExpense({
            expenseId,
            approverId: session.user.id,
            reason,
          });
          results.successful.push(expenseId);
        } else if (action === "REJECT") {
          if (!reason) {
            results.failed.push({
              id: expenseId,
              error: "Reason required for rejection",
            });
            continue;
          }

          await rejectExpense({
            expenseId,
            approverId: session.user.id,
            reason,
          });
          results.successful.push(expenseId);
        }
      } catch (error) {
        results.failed.push({
          id: expenseId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${expenseIds.length} expenses`,
      results,
    });
  } catch (error) {
    logger.error("Error processing bulk approval", error, { 
      userId: session.user.id,
      action: 'PUT',
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
