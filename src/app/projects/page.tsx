import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { ProjectsTable } from "@/components/ProjectsTable";
import { PageCreateButton } from "@/components/PageCreateButton";
import QuerySelect from "@/components/QuerySelect";
import { formatMoney } from "@/lib/format";
import { computeProjectFinancialSnapshot } from "@/lib/projects";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canViewAll = await requirePermission(session.user.id, "projects.view_all");
  const canViewAssigned = await requirePermission(session.user.id, "projects.view_assigned");
  const canEdit = await requirePermission(session.user.id, "projects.edit");
  const canViewFinancials =
    (await requirePermission(session.user.id, "projects.view_financials")) ||
    (await requirePermission(session.user.id, "dashboard.view_all_metrics"));

  if (!canViewAll && !canViewAssigned) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to projects.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const status = (params.status || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let scopeWhere: import("@prisma/client").Prisma.ProjectWhereInput = {};
  if (!canViewAll && canViewAssigned) {
    const assignments = await prisma.projectAssignment.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    const projectIds = assignments.map((assignment) => assignment.projectId);
    if (projectIds.length === 0) {
      return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-2 text-muted-foreground">No assigned projects yet.</p>
        </div>
      );
    }
    scopeWhere = { id: { in: projectIds } };
  }

  const searchWhere: import("@prisma/client").Prisma.ProjectWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { projectId: { contains: search, mode: "insensitive" as const } },
          { status: { contains: search, mode: "insensitive" as const } },
          { client: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const whereBase: import("@prisma/client").Prisma.ProjectWhereInput =
    Object.keys(searchWhere).length > 0
      ? Object.keys(scopeWhere).length > 0
        ? { AND: [scopeWhere, searchWhere] }
        : searchWhere
      : scopeWhere;
  const where: import("@prisma/client").Prisma.ProjectWhereInput = status
    ? { AND: [whereBase, { status }] }
    : whereBase;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: true },
      skip,
      take,
    }),
    prisma.project.count({ where }),
  ]);
  const serializedProjects = await Promise.all(
    projects.map(async (project) => {
      const snapshot = canViewFinancials ? await computeProjectFinancialSnapshot(project) : null;
      return {
        id: project.id,
        projectId: project.projectId,
        name: project.name,
        clientName: project.client?.name || "-",
        clientId: project.clientId,
        status: project.status,
        contractValue: canViewFinancials ? Number(snapshot?.contractValue || 0) : 0,
        pendingRecovery: canViewFinancials ? Number(snapshot?.pendingRecovery || 0) : 0,
        startDate: project.startDate.toISOString().slice(0, 10),
        endDate: project.endDate ? project.endDate.toISOString().slice(0, 10) : null,
      };
    }),
  );
  const totalPages = Math.max(1, Math.ceil(total / take));
  const stats = serializedProjects.reduce(
    (acc, project) => {
      if (project.status === "ACTIVE") acc.active += 1;
      if (project.status === "ON_HOLD") acc.onHold += 1;
      if (project.status === "COMPLETED" || project.status === "CLOSED") acc.closed += 1;
      acc.contract += Number(project.contractValue || 0);
      acc.pending += Number(project.pendingRecovery || 0);
      return acc;
    },
    { active: 0, onHold: 0, closed: 0, contract: 0, pending: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-border bg-gradient-to-br from-background via-card to-muted/30 p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="mt-2 text-muted-foreground">Track project health, timeline status, and cash recovery.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search projects..." />
            </div>
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Not Started", value: "NOT_STARTED" },
                { label: "Upcoming", value: "UPCOMING" },
                { label: "Active", value: "ACTIVE" },
                { label: "On Hold", value: "ON_HOLD" },
                { label: "Completed", value: "COMPLETED" },
                { label: "Closed", value: "CLOSED" },
              ]}
            />
            {canEdit ? (
              <PageCreateButton label="Create Project" formType="project" />
            ) : null}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Active</div>
            <div className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{stats.active}</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-sm text-amber-700 dark:text-amber-300">On Hold</div>
            <div className="text-xl font-semibold text-amber-900 dark:text-amber-100">{stats.onHold}</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="text-sm text-primary">Total Contract</div>
            <div className="text-xl font-semibold text-foreground">
              {canViewFinancials ? formatMoney(stats.contract) : "-"}
            </div>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
            <div className="text-sm text-rose-700 dark:text-rose-300">Cash To Recover</div>
            <div className="text-xl font-semibold text-rose-900 dark:text-rose-100">
              {canViewFinancials ? formatMoney(stats.pending) : "-"}
            </div>
          </div>
        </div>
      </div>

      <ProjectsTable
        projects={serializedProjects}
        canEdit={canEdit}
        canViewFinancials={canViewFinancials}
      />

      {serializedProjects.length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground shadow-sm">
          <div>No projects found.</div>
          {canEdit ? (
            <div className="mt-3">
              <PageCreateButton label="Create Project" formType="project" />
            </div>
          ) : null}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls totalPages={totalPages} currentPage={page} />
        </div>
      )}
    </div>
  );
}
