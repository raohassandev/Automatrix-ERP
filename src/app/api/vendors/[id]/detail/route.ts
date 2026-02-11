import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVendorDetailForUser } from "@/lib/vendor-detail-policy";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await getVendorDetailForUser({ userId: session.user.id, vendorDbId: id });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, data: result.data });
}

