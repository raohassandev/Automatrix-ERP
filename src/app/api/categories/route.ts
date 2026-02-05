import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canManage = await requirePermission(session.user.id, "categories.manage");
  const canUseExpense = await requirePermission(session.user.id, "expenses.submit");
  const canUseInventory = await requirePermission(session.user.id, "inventory.view");
  const canUseIncome = await requirePermission(session.user.id, "income.add");
  if (!canManage && !canUseExpense && !canUseInventory && !canUseIncome) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type'); // 'expense', 'inventory', or 'income'

  const where: { isActive: boolean; type?: string } = {
    isActive: true,
  };
  
  if (type) {
    where.type = type;
  }

  const categories = await prisma.category.findMany({
    where,
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      maxAmount: true,
      enforceStrict: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Return just the names for backward compatibility with AutoComplete components
  return NextResponse.json({ 
    success: true, 
    data: categories.map((c) => c.name),
    categories: categories // Also return full category objects for admin use
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "categories.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, type, description, maxAmount, enforceStrict } = body;

    if (!name || !type) {
      return NextResponse.json({ success: false, error: "Name and type are required" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        type,
        description,
        maxAmount: typeof maxAmount === "number" ? maxAmount : undefined,
        enforceStrict: Boolean(enforceStrict),
      },
    });

    return NextResponse.json({ success: true, data: category });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Category name already exists" }, { status: 400 });
    }
    console.error("Error creating category:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
