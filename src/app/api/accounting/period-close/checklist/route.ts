import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getPeriodCloseChecklist } from "@/lib/accounting-reports";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView =
    (await requirePermission(session.user.id, "accounting.view")) ||
    (await requirePermission(session.user.id, "accounting.manage"));
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const periodId = (searchParams.get("periodId") || "").trim();
  if (!periodId) {
    return NextResponse.json({ success: false, error: "periodId is required" }, { status: 400 });
  }

  try {
    const data = await getPeriodCloseChecklist(periodId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build checklist";
    const status = message === "Fiscal period not found." ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
