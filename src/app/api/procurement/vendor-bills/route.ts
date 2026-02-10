import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const billLineSchema = z
  .object({
    description: z.string().trim().min(1),
    itemId: z.string().trim().min(1).optional(),
    quantity: z.number().finite().positive().optional(),
    unit: z.string().trim().optional(),
    unitCost: z.number().finite().nonnegative().optional(),
    total: z.number().finite().nonnegative().optional(),
    project: z.string().trim().optional(),
    grnItemId: z.string().trim().min(1).optional(),
  })
  .refine(
    (line) => {
      const hasQtyCost = typeof line.quantity === "number" && typeof line.unitCost === "number";
      const hasTotal = typeof line.total === "number";
      return hasQtyCost || hasTotal;
    },
    { message: "Each line must include either total or (quantity + unitCost)." }
  );

const vendorBillCreateSchema = z.object({
  billNumber: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  billDate: z.string().trim().min(1),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().min(1).default("PKR"),
  notes: z.string().trim().optional(),
  lines: z.array(billLineSchema).min(1),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const where: Prisma.VendorBillWhereInput = search
    ? {
        OR: [
          { billNumber: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.vendorBill.findMany({
      where,
      orderBy: { billDate: "desc" },
      include: {
        vendor: true,
        allocations: { include: { vendorPayment: true } },
        lines: true,
      },
      skip,
      take,
    }),
    prisma.vendorBill.count({ where }),
  ]);

  const data = rows.map((bill) => {
    const paid = bill.allocations
      .filter((alloc) => alloc.vendorPayment.status === "POSTED")
      .reduce((sum, alloc) => sum + Number(alloc.amount), 0);
    const totalAmount = Number(bill.totalAmount);
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate.toISOString(),
      dueDate: bill.dueDate ? bill.dueDate.toISOString() : null,
      status: bill.status,
      currency: bill.currency,
      totalAmount,
      paidAmount: paid,
      outstandingAmount: Math.max(0, totalAmount - paid),
      vendor: { id: bill.vendor.id, name: bill.vendor.name },
      lineCount: bill.lines.length,
      notes: bill.notes,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ success: true, data, total });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = vendorBillCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

  const normalizedLines = parsed.data.lines.map((line) => {
    const total =
      typeof line.quantity === "number" && typeof line.unitCost === "number"
        ? line.quantity * line.unitCost
        : Number(line.total || 0);
    return { ...line, total };
  });

  const totalAmount = normalizedLines.reduce((sum, line) => sum + Number(line.total), 0);

    const created = await prisma.vendorBill.create({
      data: {
        billNumber: parsed.data.billNumber,
        vendorId: parsed.data.vendorId,
        billDate: new Date(parsed.data.billDate),
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
        totalAmount: new Prisma.Decimal(totalAmount),
        status: "DRAFT",
        lines: {
          create: normalizedLines.map((line) => ({
            description: line.description,
            itemId: line.itemId || undefined,
            quantity: typeof line.quantity === "number" ? new Prisma.Decimal(line.quantity) : undefined,
            unit: line.unit || undefined,
            unitCost: typeof line.unitCost === "number" ? new Prisma.Decimal(line.unitCost) : undefined,
            total: new Prisma.Decimal(line.total),
            project: line.project || undefined,
            grnItemId: line.grnItemId || undefined,
          })),
        },
      },
      include: { vendor: true, lines: true },
    });

    await logAudit({
      action: "CREATE_VENDOR_BILL",
      entity: "VendorBill",
      entityId: created.id,
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Bill number already exists" }, { status: 400 });
    }
    console.error("Error creating vendor bill:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
