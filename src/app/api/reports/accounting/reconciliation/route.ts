import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTrialBalanceRows, getProfitAndLoss, getBalanceSheet } from "@/lib/accounting-reports";
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

  const [tbRows, pnl, bs] = await Promise.all([
    getTrialBalanceRows({ from, to }),
    getProfitAndLoss({ from, to }),
    getBalanceSheet({ from, to }),
  ]);

  const tbTotals = tbRows.reduce(
    (acc, row) => {
      acc.debit += row.debit;
      acc.credit += row.credit;
      return acc;
    },
    { debit: 0, credit: 0 },
  );

  return NextResponse.json({
    success: true,
    data: {
      range: { from: from || null, to: to || null },
      checks: {
        trialBalanceBalanced: Math.abs(tbTotals.debit - tbTotals.credit) <= 0.01,
        trialBalanceDifference: Number((tbTotals.debit - tbTotals.credit).toFixed(2)),
        balanceSheetBalanced: Math.abs(bs.totals.difference) <= 0.01,
        balanceSheetDifference: bs.totals.difference,
      },
      totals: {
        trialBalanceDebit: Number(tbTotals.debit.toFixed(2)),
        trialBalanceCredit: Number(tbTotals.credit.toFixed(2)),
        pnlNetProfit: pnl.totals.netProfit,
        balanceSheetAssets: bs.totals.totalAssets,
        balanceSheetLiabilitiesPlusEquity: bs.totals.liabilitiesPlusEquity,
      },
    },
  });
}
