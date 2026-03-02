import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getO2cReconciliation } from "@/lib/accounting-reports";
import { canAccessAccountingReports } from "@/lib/accounting-report-access";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await canAccessAccountingReports(session.user.id);
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const asOf = (searchParams.get("asOf") || "").trim();

  const data = await getO2cReconciliation({ from, to, asOf });
  return NextResponse.json({ success: true, data });
}
