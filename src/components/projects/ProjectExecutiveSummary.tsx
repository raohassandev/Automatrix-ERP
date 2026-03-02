"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";
import type { ProjectDetailData } from "@/lib/project-detail-policy";

type ProjectCosts = NonNullable<ProjectDetailData["costs"]>;

type MetricTone = "good" | "warn" | "risk";

function toPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function toneClass(tone: MetricTone) {
  if (tone === "good") return "border-emerald-200 bg-emerald-50/70 text-emerald-900";
  if (tone === "warn") return "border-amber-200 bg-amber-50/80 text-amber-900";
  return "border-red-200 bg-red-50/80 text-red-900";
}

function metricTone(value: number, warnThreshold: number, riskThreshold: number): MetricTone {
  if (value >= riskThreshold) return "risk";
  if (value >= warnThreshold) return "warn";
  return "good";
}

function barFill(label: string) {
  if (label === "Money In") return "#0ea5e9";
  if (label === "AP Cost") return "#f97316";
  if (label === "Expense Cost") return "#f43f5e";
  return "#10b981";
}

const cashMixColors = ["#0ea5e9", "#f59e0b", "#ef4444"];

export function ProjectExecutiveSummary({ costs, projectId }: { costs: ProjectCosts; projectId: string }) {
  const recoveryRate = costs.invoicedAmount > 0 ? (costs.receivedAmount / costs.invoicedAmount) * 100 : 0;
  const costUtilization = costs.contractValue > 0 ? (costs.costToDate / costs.contractValue) * 100 : 0;
  const cashCoverage = costs.costToDate > 0 ? (costs.receivedAmount / costs.costToDate) * 100 : 0;
  const overdueRate = costs.pendingRecovery > 0 ? (costs.risk.overdueRecoveryAmount / costs.pendingRecovery) * 100 : 0;

  const profitBridge = [
    { label: "Money In", value: costs.approvedIncomeReceived },
    { label: "AP Cost", value: costs.apBilledTotal },
    { label: "Expense Cost", value: costs.nonStockExpensesApproved },
    { label: "Net Profit", value: costs.projectProfit },
  ];

  const cashMix = [
    { name: "Recovered", value: Math.max(0, costs.receivedAmount) },
    { name: "Pending Recovery", value: Math.max(0, costs.pendingRecovery) },
    { name: "AP Outstanding", value: Math.max(0, costs.apOutstanding) },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Executive Summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            Owner snapshot for cash control, recoveries, and project profitability.
          </p>
        </div>
        <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
          Live finance metrics
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-lg border p-3 ${toneClass(metricTone(100 - recoveryRate, 20, 40))}`}>
          <div className="text-xs">Recovery rate</div>
          <div className="mt-1 text-lg font-semibold">{toPercent(recoveryRate)}</div>
          <div className="text-xs">
            {formatMoney(costs.receivedAmount)} recovered from {formatMoney(costs.invoicedAmount)} invoiced
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${toneClass(metricTone(costUtilization, 85, 100))}`}>
          <div className="text-xs">Cost vs contract</div>
          <div className="mt-1 text-lg font-semibold">{toPercent(costUtilization)}</div>
          <div className="text-xs">
            {formatMoney(costs.costToDate)} cost against {formatMoney(costs.contractValue)} contract
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${toneClass(metricTone(100 - cashCoverage, 20, 40))}`}>
          <div className="text-xs">Cash coverage</div>
          <div className="mt-1 text-lg font-semibold">{toPercent(cashCoverage)}</div>
          <div className="text-xs">
            Money in {formatMoney(costs.receivedAmount)} vs money out {formatMoney(costs.costToDate)}
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${toneClass(metricTone(overdueRate, 20, 40))}`}>
          <div className="text-xs">Overdue within pending</div>
          <div className="mt-1 text-lg font-semibold">{toPercent(overdueRate)}</div>
          <div className="text-xs">
            {formatMoney(costs.risk.overdueRecoveryAmount)} overdue from {formatMoney(costs.pendingRecovery)} pending
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Cash Exposure Mix</h3>
          <p className="mt-1 text-xs text-slate-600">Recovered cash vs current receivable and vendor pressure</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cashMix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={88}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {cashMix.map((_, index) => (
                    <Cell key={index} fill={cashMixColors[index % cashMixColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | string | undefined) => formatMoney(Number(value || 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Profit Bridge</h3>
          <p className="mt-1 text-xs text-slate-600">How income converts into project profit after costs</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitBridge} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 12 }} />
                <YAxis tick={{ fill: "#334155", fontSize: 12 }} tickFormatter={(v) => formatMoney(Number(v || 0), "")} />
                <Tooltip formatter={(value: number | string | undefined) => formatMoney(Number(value || 0))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {profitBridge.map((row) => (
                    <Cell key={row.label} fill={barFill(row.label)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
          <div className="text-xs text-indigo-800">Pending recovery</div>
          <div className="mt-1 text-lg font-semibold text-indigo-900">{formatMoney(costs.pendingRecovery)}</div>
          <div className="text-xs text-indigo-700">{costs.risk.overdueInvoiceCount} overdue invoice(s)</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
          <div className="text-xs text-rose-800">Vendor outstanding</div>
          <div className="mt-1 text-lg font-semibold text-rose-900">{formatMoney(costs.apOutstanding)}</div>
          <div className="text-xs text-rose-700">Posted AP unpaid balance</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="text-xs text-emerald-800">Profitability</div>
          <div className="mt-1 text-lg font-semibold text-emerald-900">{formatMoney(costs.projectProfit)}</div>
          <div className="text-xs text-emerald-700">{toPercent(costs.marginPercent)} margin</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <div className="text-xs text-amber-800">Pipeline pressure</div>
          <div className="mt-1 text-lg font-semibold text-amber-900">{formatMoney(costs.pendingExpenseSubmitted)}</div>
          <div className="text-xs text-amber-700">Pending submitted expenses</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-800"
          href={`/income?search=${encodeURIComponent(projectId)}`}
        >
          Open income
        </Link>
        <Link
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-800"
          href={`/expenses/by-project?project=${encodeURIComponent(projectId)}`}
        >
          Open expenses
        </Link>
        <Link
          className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-indigo-800"
          href={`/procurement/vendor-bills?search=${encodeURIComponent(projectId)}`}
        >
          Open vendor bills
        </Link>
      </div>
    </section>
  );
}
