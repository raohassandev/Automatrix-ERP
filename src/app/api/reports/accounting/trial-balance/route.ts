import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTrialBalanceRows } from "@/lib/accounting-reports";
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
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  const rows = (await getTrialBalanceRows({ from, to }))
    .filter((row) => {
      if (!search) return true;
      return (
        row.code.toLowerCase().includes(search) ||
        row.name.toLowerCase().includes(search) ||
        row.type.toLowerCase().includes(search)
      );
    });

  const totals = rows.reduce(
    (acc, row) => {
      acc.debit += row.debit;
      acc.credit += row.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  return NextResponse.json({
    success: true,
    data: {
      from: from || null,
      to: to || null,
      rows,
      totals: {
        debit: totals.debit,
        credit: totals.credit,
        difference: Number((totals.debit - totals.credit).toFixed(2)),
      },
    },
  });
}
