import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/format";

export default async function CompanyAccountsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canManage = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canManage) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Company Accounts</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const accounts = await prisma.companyAccount.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, currency: true, isActive: true, openingBalance: true },
  });
  const totals = accounts.reduce(
    (acc, account) => {
      if (account.isActive) acc.active += 1;
      else acc.inactive += 1;
      acc.opening += Number(account.openingBalance || 0);
      return acc;
    },
    { active: 0, inactive: 0, opening: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Company Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cash and bank accounts used for all real inflow/outflow records.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Active Accounts</div>
            <div className="text-xl font-semibold text-emerald-800">{totals.active}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-sm text-slate-700">Inactive Accounts</div>
            <div className="text-xl font-semibold text-slate-800">{totals.inactive}</div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Opening Balance Total</div>
            <div className="text-xl font-semibold text-sky-800">{formatMoney(totals.opening)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Name</th>
              <th className="py-2">Type</th>
              <th className="py-2">Currency</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2 font-medium">
                  <Link className="underline underline-offset-2" href={`/company-accounts/${a.id}`}>
                    {a.name}
                  </Link>
                </td>
                <td className="py-2">{a.type}</td>
                <td className="py-2">{a.currency}</td>
                <td className="py-2">
                  <StatusBadge status={a.isActive ? "ACTIVE" : "INACTIVE"} />
                </td>
              </tr>
            ))}
            {accounts.length === 0 ? (
              <tr>
                <td className="py-3 text-sm text-muted-foreground" colSpan={4}>
                  No accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
