import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getUserRoleName } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "employees.view_all");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to employee details.</p>
      </div>
    );
  }

  const role = await getUserRoleName(session.user.id);
  const canViewPII =
    role === "HR" ||
    role === "Admin" ||
    role === "Finance Manager" ||
    role === "Accountant" ||
    role === "CFO" ||
    role === "Owner" ||
    role === "CEO";

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { compensation: true },
  });
  if (!employee) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee</h1>
        <p className="mt-2 text-muted-foreground">Employee not found.</p>
      </div>
    );
  }

  const user = await prisma.user.findUnique({ where: { email: employee.email }, select: { id: true } });
  const assignments = user?.id
    ? await prisma.projectAssignment.findMany({
        where: { userId: user.id },
        select: { project: { select: { id: true, projectId: true, name: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const walletBalance = Number(employee.walletBalance || 0);
  const walletHold = Number(employee.walletHold || 0);
  const walletAvailable = walletBalance - walletHold;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee</h1>
        <p className="mt-2 text-muted-foreground">HR/Finance view (PII permission-gated).</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{employee.email}</div>
            <h2 className="mt-1 text-xl font-semibold">{employee.name}</h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Department: {employee.department || "-"}</span>
              <span>Designation: {employee.designation || "-"}</span>
              <span>Status: {employee.status}</span>
              <span>Role: {employee.role}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Wallet Balance</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletBalance)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">On Hold</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletHold)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletAvailable)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Company Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Phone</div>
            <div className="mt-1">{employee.phone || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Join Date</div>
            <div className="mt-1">{employee.joinDate ? new Date(employee.joinDate).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Base Salary</div>
            <div className="mt-1">
              {employee.compensation ? formatMoney(Number(employee.compensation.baseSalary)) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Comp Notes</div>
            <div className="mt-1">{employee.compensation?.notes || "-"}</div>
          </div>
        </div>
      </div>

      {canViewPII ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">PII (restricted)</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">CNIC</div>
              <div className="mt-1">{employee.cnic || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Address</div>
              <div className="mt-1">{employee.address || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Education</div>
              <div className="mt-1">{employee.education || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Experience</div>
              <div className="mt-1">{employee.experience || "-"}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Assigned Projects</h2>
        <div className="mt-4 space-y-2 text-sm">
          {assignments.length === 0 ? (
            <div className="text-muted-foreground">No project assignments.</div>
          ) : (
            assignments.map((a) => (
              <div key={a.project.id} className="flex items-center justify-between border-b pb-2">
                <div className="min-w-0">
                  <div className="font-medium">
                    <a className="underline underline-offset-2" href={`/projects/${a.project.id}`}>
                      {a.project.projectId} — {a.project.name}
                    </a>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Status: {a.project.status}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

