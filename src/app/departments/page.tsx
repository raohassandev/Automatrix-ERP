import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import PaginationControls from "@/components/PaginationControls";
import { PageCreateButton } from "@/components/PageCreateButton";
import { DepartmentActions } from "@/components/DepartmentActions";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "departments.view_all");
  const canEdit = await requirePermission(session.user.id, "departments.edit");

  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to departments.</p>
      </div>
    );
  }

  const params = searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const query = (params.q || "").trim();
  const take = 25;
  const skip = (page - 1) * take;

  const where =
    query.length > 0
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {};

  const [departments, total] = await Promise.all([
    prisma.department.findMany({ where, orderBy: { name: "asc" }, skip, take }),
    prisma.department.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Departments</h1>
            <p className="mt-2 text-muted-foreground">HR department master data.</p>
          </div>
          {canEdit ? <PageCreateButton label="Create Department" formType="department" /> : null}
        </div>
      </div>

      <form className="rounded-xl border bg-card p-6 shadow-sm" method="get">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name or description"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <button className="rounded-md bg-black px-4 py-2 text-white">Apply</button>
        </div>
      </form>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Department</th>
                <th className="py-2">Status</th>
                <th className="py-2">Description</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-b">
                  <td className="py-2 font-medium">{department.name}</td>
                  <td className="py-2">{department.isActive ? "ACTIVE" : "INACTIVE"}</td>
                  <td className="py-2">{department.description || "-"}</td>
                  <td className="py-2">
                    <DepartmentActions department={department} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {departments.map((department) => (
            <div key={department.id} className="border rounded-lg p-4">
              <div className="font-semibold">{department.name}</div>
              <div className="mt-2 text-sm space-y-1">
                <div>Status: {department.isActive ? "ACTIVE" : "INACTIVE"}</div>
                <div>Description: {department.description || "-"}</div>
              </div>
              <div className="mt-3">
                <DepartmentActions department={department} canEdit={canEdit} />
              </div>
            </div>
          ))}
        </div>

        {departments.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No departments found.</div>
            {canEdit ? <PageCreateButton label="Create Department" formType="department" /> : null}
          </div>
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
