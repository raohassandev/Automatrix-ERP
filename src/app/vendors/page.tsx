import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import PaginationControls from "@/components/PaginationControls";
import { PageCreateButton } from "@/components/PageCreateButton";
import { VendorActions } from "@/components/VendorActions";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "vendors.view_all");
  const canEdit = await requirePermission(session.user.id, "vendors.edit");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to vendors.</p>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const query = (params.q || "").trim();
  const take = 25;
  const skip = (page - 1) * take;

  const where: import("@prisma/client").Prisma.VendorWhereInput =
    query.length > 0
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { contactName: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { address: { contains: query, mode: "insensitive" as const } },
            { notes: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {};

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({ where, orderBy: { name: "asc" }, skip, take }),
    prisma.vendor.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Vendors</h1>
            <p className="mt-2 text-muted-foreground">Vendor master data and contacts.</p>
          </div>
          {canEdit ? <PageCreateButton label="Create Vendor" formType="vendor" /> : null}
        </div>
      </div>

      <form className="rounded-xl border bg-card p-6 shadow-sm" method="get">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name, contact, phone"
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
                <th className="py-2">Vendor</th>
                <th className="py-2">Contact</th>
                <th className="py-2">Phone</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b">
                  <td className="py-2 font-medium">{vendor.name}</td>
                  <td className="py-2">{vendor.contactName || "-"}</td>
                  <td className="py-2">{vendor.phone || "-"}</td>
                  <td className="py-2">{vendor.status}</td>
                  <td className="py-2">
                    <VendorActions vendor={vendor} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="border rounded-lg p-4">
              <div className="font-semibold">{vendor.name}</div>
              <div className="mt-2 text-sm space-y-1">
                <div>Contact: {vendor.contactName || "-"}</div>
                <div>Phone: {vendor.phone || "-"}</div>
                <div>Status: {vendor.status}</div>
              </div>
              <div className="mt-3">
                <VendorActions vendor={vendor} canEdit={canEdit} />
              </div>
            </div>
          ))}
        </div>

        {vendors.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No vendors found.</div>
            {canEdit ? <PageCreateButton label="Create Vendor" formType="vendor" /> : null}
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
