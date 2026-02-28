import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { ProjectsTable } from "@/components/ProjectsTable";
import { PageCreateButton } from "@/components/PageCreateButton";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
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

  const where: import("@prisma/client").Prisma.ProjectWhereInput =
    Object.keys(searchWhere).length > 0
      ? Object.keys(scopeWhere).length > 0
        ? { AND: [scopeWhere, searchWhere] }
        : searchWhere
      : scopeWhere;

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
  const serializedProjects = projects.map((project) => ({
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    clientName: project.client?.name || "-",
    clientId: project.clientId,
    status: project.status,
    contractValue: Number(project.contractValue),
    pendingRecovery: Number(project.pendingRecovery),
    startDate: project.startDate.toISOString().slice(0, 10),
    endDate: project.endDate ? project.endDate.toISOString().slice(0, 10) : null,
  }));
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="mt-2 text-muted-foreground">Projects overview.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search projects..." />
            </div>
            {canEdit ? (
              <PageCreateButton label="Create Project" formType="project" />
            ) : null}
          </div>
        </div>
      </div>

      <ProjectsTable projects={serializedProjects} canEdit={canEdit} />

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
