import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { autoMatchStatementLines } from "@/lib/bank-reconciliation";
import { logAudit } from "@/lib/audit";

function parseAsOf(value?: string | null) {
  const asOf = value ? new Date(value) : new Date();
  asOf.setHours(23, 59, 59, 999);
  return asOf;
}

export async function POST(req: Request) {
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

  const body = await req.json();
  const companyAccountId = String(body.companyAccountId || "").trim();
  if (!companyAccountId) {
    return NextResponse.json({ success: false, error: "Company account is required." }, { status: 400 });
  }
  const asOfDate = parseAsOf(body.asOfDate ? String(body.asOfDate) : undefined);
  const result = await autoMatchStatementLines(companyAccountId, asOfDate);

  await logAudit({
    action: "AUTO_MATCH_BANK_STATEMENT",
    entity: "BankStatementLine",
    entityId: companyAccountId,
    newValue: JSON.stringify({ asOfDate: asOfDate.toISOString(), ...result }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: result });
}
