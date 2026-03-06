import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveHrmsScope } from "@/lib/hrms-access";
import SearchInput from "@/components/SearchInput";
import QuerySelect from "@/components/QuerySelect";
import DateRangePicker from "@/components/DateRangePicker";
import { AttendanceManager } from "@/components/hrms/AttendanceManager";

export default async function HrmsAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const scope = await resolveHrmsScope(session.user.id, session.user.email);
  if (!scope.canManage && !scope.employeeId) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">HRMS Attendance</h1>
        <p className="mt-2 text-muted-foreground">You do not have access.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const status = (params.status || "").trim();
  const from = (params.from || "").trim();
  const to = (params.to || "").trim();

  const where: import("@prisma/client").Prisma.AttendanceEntryWhereInput = {};
  if (scope.employeeId) {
    where.employeeId = scope.employeeId;
  }
  if (status) where.status = status;
  if (from || to) {
    where.date = {
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
    prisma.attendanceEntry.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const summary = rowsRaw.reduce(
    (acc, row) => {
      if (row.status === "PRESENT") acc.present += 1;
      if (row.status === "ABSENT") acc.absent += 1;
      if (row.status === "LEAVE") acc.leave += 1;
      return acc;
    },
    { present: 0, absent: 0, leave: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">HRMS Attendance</h1>
            <p className="mt-2 text-muted-foreground">
              Daily attendance register with instant status control.
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
                { label: "Present", value: "PRESENT" },
                { label: "Absent", value: "ABSENT" },
                { label: "Late", value: "LATE" },
                { label: "Half Day", value: "HALF_DAY" },
                { label: "WFH", value: "WFH" },
                { label: "Leave", value: "LEAVE" },
              ]}
            />
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Entries</div>
            <div className="text-xl font-semibold text-sky-800">{rowsRaw.length}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Present</div>
            <div className="text-xl font-semibold text-emerald-800">{summary.present}</div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4">
            <div className="text-sm text-rose-700">Absent</div>
            <div className="text-xl font-semibold text-rose-800">{summary.absent}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">Leave</div>
            <div className="text-xl font-semibold text-amber-800">{summary.leave}</div>
          </div>
        </div>
      </div>

      <AttendanceManager
        employees={employeesRaw}
        rows={rowsRaw.map((row) => ({
          ...row,
          date: row.date.toISOString(),
          employee: row.employee,
        }))}
        canManage={scope.canManage}
        ownEmployeeId={scope.employeeId}
      />
    </div>
  );
}
