import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveHrmsScope } from "@/lib/hrms-access";
import SearchInput from "@/components/SearchInput";
import QuerySelect from "@/components/QuerySelect";
import DateRangePicker from "@/components/DateRangePicker";
import { LeaveManager } from "@/components/hrms/LeaveManager";

export default async function HrmsLeavePage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; from?: string; to?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const scope = await resolveHrmsScope(session.user.id, session.user.email);
  if (!scope.canManage && !scope.employeeId) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">HRMS Leave</h1>
        <p className="mt-2 text-muted-foreground">You do not have access.</p>
      </div>
    );
  }

  const search = (searchParams.search || "").trim();
  const status = (searchParams.status || "").trim();
  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();

  const where: import("@prisma/client").Prisma.LeaveRequestWhereInput = {};
  if (scope.employeeId) {
    where.employeeId = scope.employeeId;
  }
  if (status) where.status = status;
  if (from || to) {
    where.startDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (search) {
    where.employee = {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    };
  }

  const [employeesRaw, rowsRaw] = await Promise.all([
    prisma.employee.findMany({
      where: scope.canManage ? {} : { id: scope.employeeId || "__none__" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const summary = rowsRaw.reduce(
    (acc, row) => {
      if (row.status === "PENDING") acc.pending += 1;
      if (row.status === "APPROVED") acc.approved += 1;
      if (row.status === "REJECTED") acc.rejected += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">HRMS Leave Management</h1>
            <p className="mt-2 text-muted-foreground">
              End-to-end leave request and approval flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee..." />
            </div>
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Pending", value: "PENDING" },
                { label: "Approved", value: "APPROVED" },
                { label: "Rejected", value: "REJECTED" },
                { label: "Cancelled", value: "CANCELLED" },
              ]}
            />
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Requests</div>
            <div className="text-xl font-semibold text-sky-800">{rowsRaw.length}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">Pending</div>
            <div className="text-xl font-semibold text-amber-800">{summary.pending}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Approved</div>
            <div className="text-xl font-semibold text-emerald-800">{summary.approved}</div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4">
            <div className="text-sm text-rose-700">Rejected</div>
            <div className="text-xl font-semibold text-rose-800">{summary.rejected}</div>
          </div>
        </div>
      </div>

      <LeaveManager
        employees={employeesRaw}
        rows={rowsRaw.map((row) => ({
          ...row,
          startDate: row.startDate.toISOString(),
          endDate: row.endDate.toISOString(),
          totalDays: Number(row.totalDays),
          employee: row.employee,
        }))}
        canManage={scope.canManage}
        canApprove={scope.canApprove}
        ownEmployeeId={scope.employeeId}
      />
    </div>
  );
}
