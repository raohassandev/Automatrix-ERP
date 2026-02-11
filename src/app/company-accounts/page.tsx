import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Company Accounts</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cash/Bank accounts (finance-lite, Phase 1).</p>

      <div className="mt-4 overflow-x-auto">
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
                <td className="py-2">{a.isActive ? "ACTIVE" : "INACTIVE"}</td>
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
  );
}

