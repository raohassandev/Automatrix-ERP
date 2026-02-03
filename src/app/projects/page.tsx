import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { MobileCard } from "@/components/MobileCard";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

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

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { projectId: { contains: search, mode: "insensitive" } },
          { status: { contains: search, mode: "insensitive" } },
          { client: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

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
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="mt-2 text-muted-foreground">Projects overview.</p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search projects..." />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Project</th>
                <th className="py-2">Client</th>
                <th className="py-2">Status</th>
                <th className="py-2">Contract</th>
                <th className="py-2">Pending</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b">
                  <td className="py-2">{project.name}</td>
                  <td className="py-2">{project.client?.name || "-"}</td>
                  <td className="py-2">{project.status}</td>
                  <td className="py-2">{formatMoney(Number(project.contractValue))}</td>
                  <td className="py-2">{formatMoney(Number(project.pendingRecovery))}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <QuickEditButton
                        url={`/api/projects/${project.id}`}
                        fields={{ status: "Status", contractValue: "Contract Value", endDate: "End Date" }}
                      />
                      <DeleteButton url={`/api/projects/${project.id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-4">
          {projects.map((project) => (
            <MobileCard
              key={project.id}
              title={project.name}
              subtitle={project.client?.name || "-"}
              fields={[
                { label: "Status", value: project.status },
                { label: "Contract", value: formatMoney(Number(project.contractValue)) },
                { label: "Pending", value: formatMoney(Number(project.pendingRecovery)) },
              ]}
              actions={
                <>
                  <QuickEditButton
                    url={`/api/projects/${project.id}`}
                    fields={{ status: "Status", contractValue: "Contract Value", endDate: "End Date" }}
                  />
                  <DeleteButton url={`/api/projects/${project.id}`} />
                </>
              }
            />
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No projects found.</div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
