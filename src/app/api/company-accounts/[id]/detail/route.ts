import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompanyAccountDetailForUser } from "@/lib/company-account-detail-policy";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const paymentsPage = Math.max(parseInt(searchParams.get("paymentsPage") || "1", 10), 1);

  const result = await getCompanyAccountDetailForUser({
    userId: session.user.id,
    companyAccountId: id,
    paymentsPage,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, data: result.data });
}

