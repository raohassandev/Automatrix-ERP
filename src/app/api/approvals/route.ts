import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, type RoleName } from "@/lib/permissions";
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

function canApproveWithRole(roleName: RoleName) {
  return (
    hasPermission(roleName, "expenses.approve_low") ||
    hasPermission(roleName, "expenses.approve_medium") ||
    hasPermission(roleName, "expenses.approve_high") ||
    hasPermission(roleName, "approvals.approve_low") ||
    hasPermission(roleName, "approvals.approve_high") ||
    hasPermission(roleName, "approvals.partial_approve")
  );
}

/**
 * GET /api/approvals - Get pending approvals for current user
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'pending' or 'stats'

    if (type === "stats") {
      // Get approval statistics
      const stats = await getApprovalStats();
      return NextResponse.json(stats);
    }

    // Get pending approvals for user
    const pendingApprovals = await getPendingApprovalsForUser(session.user.id);

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

  const roleName = ((session.user as { role?: string }).role || "Guest") as RoleName;
  
  // Check if user has approval permissions
  if (!canApproveWithRole(roleName)) {
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
    if (validated.incomeId) {
      if (validated.action === "APPROVE" || validated.action === "PARTIAL_APPROVE") {
        const result = await approveIncome({
          incomeId: validated.incomeId,
          approverId: session.user.id,
          reason: validated.reason,
          approvedAmount: validated.approvedAmount,
        });

        return NextResponse.json({
          success: true,
          message: "Income approved successfully",
          data: result,
        });
      } else if (validated.action === "REJECT") {
        if (!validated.reason) {
          return NextResponse.json(
            { error: "Reason is required for rejection" },
            { status: 400 }
          );
        }

        const result = await rejectIncome({
          incomeId: validated.incomeId,
          approverId: session.user.id,
          reason: validated.reason,
        });

        return NextResponse.json({
          success: true,
          message: "Income rejected successfully",
          data: result,
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

  const roleName = ((session.user as { role?: string }).role || "Guest") as RoleName;
  
  if (!canApproveWithRole(roleName)) {
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
