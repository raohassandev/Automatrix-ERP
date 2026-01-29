import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const incomeSources = await prisma.income.findMany({
    select: {
      source: true,
    },
    distinct: ['source'],
    where: {
      source: {
        not: null,
      },
    },
    orderBy: {
      source: 'asc',
    },
  });

  return NextResponse.json({ success: true, data: incomeSources.map((s) => s.source) });
}