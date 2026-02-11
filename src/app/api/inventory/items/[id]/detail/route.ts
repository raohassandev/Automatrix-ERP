import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getItemDetailForUser } from "@/lib/item-detail-policy";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const ledgerPage = Math.max(parseInt(searchParams.get("ledgerPage") || "1", 10), 1);

  const result = await getItemDetailForUser({
    userId: session.user.id,
    itemDbId: id,
    ledgerPage,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, data: result.data });
}

