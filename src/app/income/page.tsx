import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import IncomeForm from "@/components/IncomeForm";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function IncomePage() {
  const session = await auth();
  const userId = session?.user?.id;

 if (!userId) {
     return (
     redirect("/login")
     );
   }

  const canViewAll = await requirePermission(userId, "income.view_all");
  const canViewOwn = await requirePermission(userId, "income.view_own");
  const canExport = canViewAll || canViewOwn;

  const entries = await prisma.income.findMany({
    where: canViewAll ? {} : canViewOwn ? { addedById: userId } : { id: "__none__" },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Income</h1>
            <p className="mt-2 text-gray-600">Latest 25 income entries.</p>
          </div>
          {canExport ? (
            <Link
              href="/api/income/export"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </Link>
          ) : null}
        </div>
      </div>

      <IncomeForm />

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Date</th>
                <th className="py-2">Source</th>
                <th className="py-2">Category</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.source}</td>
                  <td className="py-2">{entry.category}</td>
                  <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                  <td className="py-2">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
