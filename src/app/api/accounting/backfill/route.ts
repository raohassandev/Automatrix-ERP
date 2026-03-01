import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { runAccountingBackfill } from "@/lib/accounting-backfill";

const requestSchema = z.object({
  dryRun: z.boolean().optional(),
  limitPerModule: z.number().int().min(1).max(5000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runAccountingBackfill({
    dryRun: parsed.data.dryRun,
    limitPerModule: parsed.data.limitPerModule,
    userId: session.user.id,
  });

  await logAudit({
    action: result.dryRun ? "BACKFILL_ACCOUNTING_DRY_RUN" : "BACKFILL_ACCOUNTING_APPLY",
    entity: "Accounting",
    entityId: "JOURNAL_BACKFILL",
    newValue: JSON.stringify({ request: parsed.data, totals: result.totals }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: result });
}
