import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { resolveProjectId } from "@/lib/projects";

const allocationSchema = z.object({
  vendorBillId: z.string().trim().min(1),
  amount: z.number().finite().nonnegative(),
});

const vendorPaymentCreateSchema = z.object({
  paymentNumber: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  projectRef: z.string().trim().min(1),
  paymentDate: z.string().trim().min(1),
  companyAccountId: z.string().trim().min(1),
  method: z.string().trim().optional(),
  amount: z.number().finite().nonnegative(),
  notes: z.string().trim().optional(),
  allocations: z.array(allocationSchema).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Vendor payments are finance/AP only (Phase 1).
  const canView = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const where: Prisma.VendorPaymentWhereInput = search
    ? {
        OR: [
          { paymentNumber: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
          { companyAccount: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.vendorPayment.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      include: {
        vendor: true,
        companyAccount: true,
        allocations: true,
      },
      skip,
      take,
    }),
    prisma.vendorPayment.count({ where }),
  ]);

  const data = rows.map((payment) => {
    const allocated = payment.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const amount = Number(payment.amount);
    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      projectRef: payment.projectRef,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      method: payment.method,
      amount,
      allocatedAmount: allocated,
      unallocatedAmount: Math.max(0, amount - allocated),
      vendor: { id: payment.vendor.id, name: payment.vendor.name },
      companyAccount: { id: payment.companyAccount.id, name: payment.companyAccount.name },
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ success: true, data, total });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Vendor payments are finance/AP only (Phase 1).
  const canEdit = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = vendorPaymentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const allocations = (parsed.data.allocations || []).filter((a) => a.amount > 0);
    const allocationSum = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (allocationSum > parsed.data.amount) {
      return NextResponse.json(
        { success: false, error: "Allocation total cannot exceed payment amount." },
        { status: 400 }
      );
    }

    const resolvedProjectRef = await resolveProjectId(parsed.data.projectRef);
    if (!resolvedProjectRef) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 400 });
    }

    if (allocations.length > 0) {
      const billIds = allocations.map((a) => a.vendorBillId);
      const bills = await prisma.vendorBill.findMany({
        where: { id: { in: billIds } },
        select: { id: true, vendorId: true, status: true, projectRef: true },
      });
      const byId = new Map(bills.map((b) => [b.id, b]));
      for (const alloc of allocations) {
        const bill = byId.get(alloc.vendorBillId);
        if (!bill) {
          return NextResponse.json({ success: false, error: "Invalid vendor bill allocation." }, { status: 400 });
        }
        if (bill.vendorId !== parsed.data.vendorId) {
          return NextResponse.json({ success: false, error: "Allocations must match the selected vendor." }, { status: 400 });
        }
        if (bill.status !== "POSTED") {
          return NextResponse.json({ success: false, error: "Allocations are allowed only against POSTED bills." }, { status: 400 });
        }
        const billProject = bill.projectRef ? await resolveProjectId(bill.projectRef) : null;
        if (!billProject || billProject !== resolvedProjectRef) {
          return NextResponse.json({ success: false, error: "Allocations must match the payment project (Phase 1)." }, { status: 400 });
        }
      }
    }

    const created = await prisma.vendorPayment.create({
      data: {
        paymentNumber: parsed.data.paymentNumber,
        vendorId: parsed.data.vendorId,
        projectRef: resolvedProjectRef,
        paymentDate: new Date(parsed.data.paymentDate),
        companyAccountId: parsed.data.companyAccountId,
        method: parsed.data.method,
        amount: new Prisma.Decimal(parsed.data.amount),
        status: "DRAFT",
        notes: parsed.data.notes,
        allocations: allocations.length
          ? {
              create: allocations.map((a) => ({
                vendorBillId: a.vendorBillId,
                amount: new Prisma.Decimal(a.amount),
              })),
            }
          : undefined,
      },
      include: { vendor: true, companyAccount: true, allocations: true },
    });

    if (created.allocations.length > 0) {
      await prisma.vendorPaymentAllocation.updateMany({
        where: { vendorPaymentId: created.id },
        data: {
          sourceType: "VENDOR_PAYMENT",
          sourceId: created.id,
        },
      });
    }

    await logAudit({
      action: "CREATE_VENDOR_PAYMENT",
      entity: "VendorPayment",
      entityId: created.id,
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Payment number already exists" },
        { status: 400 }
      );
    }
    console.error("Error creating vendor payment:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
