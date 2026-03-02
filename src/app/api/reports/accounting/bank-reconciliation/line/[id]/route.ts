import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canManage =
    (await requirePermission(session.user.id, "accounting.manage")) ||
    (await requirePermission(session.user.id, "company_accounts.manage"));
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const action = String(body.action || "").toUpperCase();

  if (!["EXCLUDE", "UNMATCH", "MATCH_MANUAL"].includes(action)) {
    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  }

  if (action === "EXCLUDE") {
    const row = await prisma.bankStatementLine.update({
      where: { id },
      data: {
        status: "EXCLUDED",
        matchedSourceType: null,
        matchedSourceId: null,
        matchedAt: null,
      },
    });
    await logAudit({
      action: "EXCLUDE_BANK_STATEMENT_LINE",
      entity: "BankStatementLine",
      entityId: id,
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: row });
  }

  if (action === "UNMATCH") {
    const row = await prisma.bankStatementLine.update({
      where: { id },
      data: {
        status: "UNMATCHED",
        matchedSourceType: null,
        matchedSourceId: null,
        matchedAt: null,
      },
    });
    await logAudit({
      action: "UNMATCH_BANK_STATEMENT_LINE",
      entity: "BankStatementLine",
      entityId: id,
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: row });
  }

  const matchedSourceType = String(body.matchedSourceType || "").trim();
  const matchedSourceId = String(body.matchedSourceId || "").trim();
  if (!matchedSourceType || !matchedSourceId) {
    return NextResponse.json(
      { success: false, error: "matchedSourceType and matchedSourceId are required for manual match." },
      { status: 400 },
    );
  }
  const row = await prisma.bankStatementLine.update({
    where: { id },
    data: {
      status: "MATCHED",
      matchedSourceType,
      matchedSourceId,
      matchedAt: new Date(),
    },
  });
  await logAudit({
    action: "MANUAL_MATCH_BANK_STATEMENT_LINE",
    entity: "BankStatementLine",
    entityId: id,
    newValue: JSON.stringify({ matchedSourceType, matchedSourceId }),
    userId: session.user.id,
  });
  return NextResponse.json({ success: true, data: row });
}
