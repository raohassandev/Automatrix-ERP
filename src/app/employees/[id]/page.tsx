import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getUserRoleName } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { employeeCodeFromId } from "@/lib/employee-display";
import { canManageEmployeeCompensation } from "@/lib/employee-compensation-access";
import { EmployeeCompensationDialog } from "@/components/EmployeeCompensationDialog";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const canViewAll = await requirePermission(session.user.id, "employees.view_all");
  const canViewTeam = await requirePermission(session.user.id, "employees.view_team");
  const currentUserEmployee = session.user.email
    ? await prisma.employee.findUnique({
        where: { email: session.user.email },
        select: { id: true, directReports: { select: { id: true } } },
      })
    : null;
  const canViewOwn = currentUserEmployee?.id === id;
  const canViewDirectReport =
    canViewTeam &&
    Boolean(currentUserEmployee?.directReports.some((report) => report.id === id));

  if (!canViewAll && !canViewOwn && !canViewDirectReport) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to employee details.</p>
      </div>
    );
  }

  const role = await getUserRoleName(session.user.id);
  const canEditCompensation = await canManageEmployeeCompensation(session.user.id);
  const canViewClientPreview = await requirePermission(session.user.id, "employees.view_client_preview");
  const canViewPII =
    role === "HR" ||
    role === "Admin" ||
    role === "Finance Manager" ||
    role === "Accountant" ||
    role === "CFO" ||
    role === "Owner" ||
    role === "CEO";

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
  const [assignments, walletEntries, expenses, payrollEntries, incentiveEntries, salaryAdvances] = await Promise.all([
    user?.id
      ? prisma.projectAssignment.findMany({
          where: { userId: user.id },
          select: { project: { select: { id: true, projectId: true, name: true, status: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    prisma.walletLedger.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: "desc" },
      take: 20,
    }),
    user?.id
      ? prisma.expense.findMany({
          where: { submittedById: user.id },
          orderBy: { date: "desc" },
          take: 20,
          select: {
            id: true,
            date: true,
            description: true,
            category: true,
            amount: true,
            approvedAmount: true,
            status: true,
            project: true,
            paymentSource: true,
          },
        })
      : Promise.resolve([]),
    prisma.payrollEntry.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { payrollRun: true },
    }),
    prisma.incentiveEntry.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.salaryAdvance.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

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
            <div className="mt-1 text-xs text-muted-foreground">{employeeCodeFromId(employee.id)}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Department: {employee.department || "-"}</span>
              <span>Designation: {employee.designation || "-"}</span>
              <span>Status: {employee.status}</span>
              <span>Role: {employee.role}</span>
            </div>
          </div>
          {canViewClientPreview ? (
            <a
              href={`/employees/${employee.id}/dashboard-preview`}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              View Dashboard Preview
            </a>
          ) : null}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Company Profile</h2>
          <EmployeeCompensationDialog
            employeeId={employee.id}
            employeeName={employee.name}
            canEdit={canEditCompensation}
            baseSalary={employee.compensation ? Number(employee.compensation.baseSalary) : 0}
            currency={employee.compensation?.currency || "PKR"}
            effectiveFrom={employee.compensation?.effectiveFrom ? employee.compensation.effectiveFrom.toISOString().slice(0, 10) : ""}
            notes={employee.compensation?.notes || ""}
          />
        </div>
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
          <div>
            <div className="text-xs text-muted-foreground">Effective From</div>
            <div className="mt-1">
              {employee.compensation?.effectiveFrom
                ? new Date(employee.compensation.effectiveFrom).toLocaleDateString()
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Currency</div>
            <div className="mt-1">{employee.compensation?.currency || "PKR"}</div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Wallet Ledger</h2>
            <a
              href={`/wallets?employeeId=${employee.id}`}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Full History
            </a>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Incoming, outgoing, and hold-affecting wallet movements.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {walletEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="py-2">{entry.type}</td>
                    <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                    <td className="py-2">{entry.reference || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {walletEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No wallet transactions yet.</div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Submitted Expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Employee-submitted expenses with approval status and project impact.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const usedAmount =
                    exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount
                      ? Number(exp.approvedAmount)
                      : Number(exp.amount);
                  return (
                    <tr key={exp.id} className="border-b">
                      <td className="py-2">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="py-2">
                        {exp.description}
                        <div className="text-xs text-muted-foreground">{exp.category} • {exp.paymentSource}</div>
                      </td>
                      <td className="py-2">{exp.project || "-"}</td>
                      <td className="py-2">{formatMoney(usedAmount)}</td>
                      <td className="py-2">{exp.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {expenses.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No submitted expenses yet.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Salary History</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Period</th>
                  <th className="py-2">Net Pay</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payrollEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">
                      {entry.payrollRun
                        ? `${new Date(entry.payrollRun.periodStart).toLocaleDateString()} - ${new Date(
                            entry.payrollRun.periodEnd,
                          ).toLocaleDateString()}`
                        : "-"}
                    </td>
                    <td className="py-2">{formatMoney(Number(entry.netPay))}</td>
                    <td className="py-2">{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payrollEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No salary records yet.</div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Incentive History</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {incentiveEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{entry.projectRef || "-"}</td>
                    <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                    <td className="py-2">{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {incentiveEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No incentives recorded yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Salary Advances</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {salaryAdvances.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                  <td className="py-2">{entry.reason}</td>
                  <td className="py-2">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {salaryAdvances.length === 0 && (
          <div className="py-6 text-center text-muted-foreground">No salary advances.</div>
        )}
      </div>
    </div>
  );
}
