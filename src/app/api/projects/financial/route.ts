import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "projects.view_all");
  const canViewAssigned = await requirePermission(session.user.id, "projects.view_assigned");
  
  if (!canViewAll && !canViewAssigned) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get projects with financial data
    const projects = await prisma.project.findMany({
      orderBy: [
        { costToDate: "desc" },
        { name: "asc" },
      ],
      include: { client: true },
    });

    // Get expense counts and latest expense dates for each project
    const projectsWithExpenseData = await Promise.all(
      projects.map(async (project) => {
        const expenseData = await prisma.expense.aggregate({
          where: { project: { in: [project.projectId, project.name] } },
          _count: true,
        });

        const latestExpense = await prisma.expense.findFirst({
          where: { project: { in: [project.projectId, project.name] } },
          orderBy: { date: 'desc' },
          select: { date: true }
        });

        return {
          ...project,
          expenseCount: expenseData._count,
          lastExpenseDate: latestExpense?.date?.toISOString() || null,
        };
      })
    );

    // Transform data for frontend
    const projectsWithFinancials = projectsWithExpenseData.map(project => ({
      id: project.id,
      projectId: project.projectId,
      name: project.name,
      clientName: project.client?.name || "",
      contractValue: Number(project.contractValue),
      costToDate: Number(project.costToDate),
      grossMargin: Number(project.grossMargin),
      marginPercent: Number(project.marginPercent),
      status: project.status,
      expenseCount: project.expenseCount,
      lastExpenseDate: project.lastExpenseDate,
    }));

    return NextResponse.json({
      success: true,
      projects: projectsWithFinancials
    });
  } catch (error) {
    console.error("Error fetching project financials:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
