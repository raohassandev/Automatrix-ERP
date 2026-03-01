import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import DateRangePicker from "@/components/DateRangePicker";
import SearchInput from "@/components/SearchInput";
import QueryInput from "@/components/QueryInput";
import Link from "next/link";
import { formatMoney } from "@/lib/format";

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    from?: string;
    to?: string;
    status?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canView = await requirePermission(session.user.id, "accounting.view");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Journals</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to accounting.</p>
      </div>
    );
  }

  const search = (searchParams.search || "").trim();
  const status = (searchParams.status || "").trim().toUpperCase();
  const from = searchParams.from;
  const to = searchParams.to;

  const where: import("@prisma/client").Prisma.JournalEntryWhereInput = {};
  if (search) {
    where.OR = [
      { voucherNo: { contains: search, mode: "insensitive" } },
      { memo: { contains: search, mode: "insensitive" } },
      { sourceType: { contains: search, mode: "insensitive" } },
      { sourceId: { contains: search, mode: "insensitive" } },
    ];
  }
  if (["DRAFT", "POSTED", "REVERSED"].includes(status)) where.status = status;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.postingDate = range;
  }

  const journals = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
    include: { lines: { select: { debit: true, credit: true } } },
    take: 200,
  });

  const rows = journals.map((j) => {
    const debit = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const credit = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    return { ...j, debit, credit };
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Journals</h1>
            <p className="mt-2 text-muted-foreground">Posted and draft journal entries with source traceability.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search voucher/source..." />
            </div>
            <div className="min-w-[150px]">
              <QueryInput param="status" placeholder="status=POSTED" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Voucher</th>
                <th className="py-2">Posting Date</th>
                <th className="py-2">Source</th>
                <th className="py-2">Debit</th>
                <th className="py-2">Credit</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} className="border-b">
                  <td className="py-2 font-medium">
                    <Link href={`/accounting/journals/${j.id}`} className="underline">
                      {j.voucherNo}
                    </Link>
                  </td>
                  <td className="py-2">{j.postingDate.toISOString().slice(0, 10)}</td>
                  <td className="py-2">{j.sourceType ? `${j.sourceType}:${j.sourceId}` : "-"}</td>
                  <td className="py-2">{formatMoney(j.debit)}</td>
                  <td className="py-2">{formatMoney(j.credit)}</td>
                  <td className="py-2">{j.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="py-8 text-center text-muted-foreground">No journals found.</div> : null}
      </div>
    </div>
  );
}
