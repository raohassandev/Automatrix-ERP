import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { ClientActions } from "@/components/ClientActions";
import PaginationControls from "@/components/PaginationControls";
import { PageCreateButton } from "@/components/PageCreateButton";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "clients.view_all");
  const canCreate = await requirePermission(session.user.id, "clients.edit");
  if (!canViewAll) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to clients.</p>
      </div>
    );
  }

  const params = searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const query = (params.q || "").trim();
  const take = 25;
  const skip = (page - 1) * take;

  const where: import("@prisma/client").Prisma.ClientWhereInput =
    query.length > 0
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { address: { contains: query, mode: "insensitive" as const } },
            { contacts: { some: { name: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      include: { contacts: true },
      skip,
      take,
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Clients</h1>
            <p className="mt-2 text-muted-foreground">Client master data and contacts.</p>
          </div>
          {canCreate ? <PageCreateButton label="Create Client" formType="client" /> : null}
        </div>
      </div>

      <form className="rounded-xl border bg-card p-6 shadow-sm" method="get">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name, contact, address"
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
                <th className="py-2">Business Name</th>
                <th className="py-2">Primary Contact</th>
                <th className="py-2">Phone</th>
                <th className="py-2">Address</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const primaryContact = client.contacts[0];
                return (
                  <tr key={client.id} className="border-b">
                    <td className="py-2 font-medium">{client.name}</td>
                    <td className="py-2">{primaryContact?.name || "-"}</td>
                    <td className="py-2">{primaryContact?.phone || "-"}</td>
                    <td className="py-2">{client.address || "-"}</td>
                    <td className="py-2">
                      <ClientActions client={client} canEdit={canCreate} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {clients.map((client) => {
            const primaryContact = client.contacts[0];
            return (
              <div key={client.id} className="border rounded-lg p-4">
                <div className="font-semibold">{client.name}</div>
                <div className="mt-2 text-sm space-y-1">
                  <div>Contact: {primaryContact?.name || "-"}</div>
                  <div>Phone: {primaryContact?.phone || "-"}</div>
                  <div>Address: {client.address || "-"}</div>
                </div>
                <div className="mt-3">
                  <ClientActions client={client} canEdit={canCreate} />
                </div>
              </div>
            );
          })}
        </div>

        {clients.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No clients found.</div>
            {canCreate ? <PageCreateButton label="Create Client" formType="client" /> : null}
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
