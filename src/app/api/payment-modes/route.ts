import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const paymentModes = await prisma.expense.findMany({
    select: {
      paymentMode: true,
    },
    distinct: ['paymentMode'],
    orderBy: {
      paymentMode: 'asc',
    },
  });

  return NextResponse.json({ success: true, data: paymentModes.map((pm) => pm.paymentMode) });
}
