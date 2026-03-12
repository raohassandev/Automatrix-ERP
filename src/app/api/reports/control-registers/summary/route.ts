import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getControlRegistersSummary } from "@/lib/control-registers";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewReports =
    (await requirePermission(session.user.id, "reports.view_all")) ||
    (await requirePermission(session.user.id, "dashboard.view_all_metrics"));
  if (!canViewReports) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const data = await getControlRegistersSummary({ from, to });
  return NextResponse.json({ success: true, data });
}

