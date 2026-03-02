import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { getCashPosition } from "@/lib/accounting-reports";
import { canAccessAccountingReports } from "@/lib/accounting-report-access";

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

  const canExport = await requirePermission(session.user.id, "reports.export");
  const canView = await canAccessAccountingReports(session.user.id);
  if (!canView || !canExport) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const data = await getCashPosition({ from, to });

  const lines = [
    ["From", from || ""].map(esc).join(","),
    ["To", to || ""].map(esc).join(","),
    "",
    ["Account", "Type", "Opening", "Inflow", "Outflow", "Closing"].map(esc).join(","),
    ...data.rows.map((row) =>
      [row.companyAccountName, row.accountType, row.opening, row.inflow, row.outflow, row.closing].map(esc).join(","),
    ),
    ["TOTAL", "", data.totals.opening, data.totals.inflow, data.totals.outflow, data.totals.closing].map(esc).join(","),
  ];

  await logAudit({
    action: "EXPORT_CASH_POSITION_CSV",
    entity: "Report",
    entityId: "cash-position",
    newValue: JSON.stringify({ route: "/api/reports/accounting/cash-position/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"cash_position_${new Date().toISOString().slice(0, 10)}.csv\"`,
      "Cache-Control": "no-store",
    },
  });
}
