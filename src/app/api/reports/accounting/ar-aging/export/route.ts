import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getArAging } from "@/lib/accounting-reports";

function esc(value: string | number) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canExport = await requirePermission(session.user.id, "reports.export");
  if ((!canViewAll && !canViewTeam && !canViewOwn) || !canExport) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const asOf = (searchParams.get("asOf") || "").trim();
  const data = await getArAging({ asOf });

  const lines = [
    ["As Of", asOf || ""].map(esc).join(","),
    "",
    ["Invoice #", "Project", "Invoice Date", "Due Date", "Total", "Paid", "Outstanding", "Overdue Days", "Bucket"].map(esc).join(","),
    ...data.rows.map((row) =>
      [
        row.invoiceNo,
        row.projectId,
        row.invoiceDate,
        row.dueDate,
        row.totalAmount,
        row.paidAmount,
        row.outstandingAmount,
        row.overdueDays,
        row.bucket,
      ]
        .map(esc)
        .join(","),
    ),
  ];

  await logAudit({
    action: "EXPORT_AR_AGING_CSV",
    entity: "Report",
    entityId: "ar-aging",
    newValue: JSON.stringify({ route: "/api/reports/accounting/ar-aging/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"ar_aging_${new Date().toISOString().slice(0, 10)}.csv\"`,
      "Cache-Control": "no-store",
    },
  });
}
