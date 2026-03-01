import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "accounting.view");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Journal Detail</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to accounting.</p>
      </div>
    );
  }

  const { id } = await params;
  const journal = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          glAccount: { select: { code: true, name: true } },
          project: { select: { projectId: true, name: true } },
          employee: { select: { name: true } },
        },
      },
      fiscalPeriod: { select: { code: true, status: true } },
    },
  });

  if (!journal) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Journal Detail</h1>
        <p className="mt-2 text-muted-foreground">Journal not found.</p>
      </div>
    );
  }

  const debit = journal.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const credit = journal.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Journal {journal.voucherNo}</h1>
        <p className="mt-2 text-muted-foreground">
          Source: {journal.sourceType || "-"} {journal.sourceId || "-"} | Status: {journal.status}
        </p>
        <div className="mt-3 text-sm text-muted-foreground">
          Posting Date: {journal.postingDate.toISOString().slice(0, 10)} | Fiscal Period: {journal.fiscalPeriod?.code || "-"}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Account</th>
                <th className="py-2">Project</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Debit</th>
                <th className="py-2">Credit</th>
                <th className="py-2">Memo</th>
              </tr>
            </thead>
            <tbody>
              {journal.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2">{line.glAccount.code} - {line.glAccount.name}</td>
                  <td className="py-2">{line.project ? `${line.project.projectId} - ${line.project.name}` : "-"}</td>
                  <td className="py-2">{line.employee?.name || "-"}</td>
                  <td className="py-2">{formatMoney(Number(line.debit))}</td>
                  <td className="py-2">{formatMoney(Number(line.credit))}</td>
                  <td className="py-2">{line.memo || "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2">Total</td>
                <td />
                <td />
                <td className="py-2">{formatMoney(debit)}</td>
                <td className="py-2">{formatMoney(credit)}</td>
                <td className="py-2">{Math.abs(debit - credit) <= 0.01 ? "Balanced" : "Unbalanced"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
