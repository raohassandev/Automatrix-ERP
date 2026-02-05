import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AttachmentForm from "@/components/AttachmentForm";
import { AttachmentActions } from "@/components/AttachmentActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function AttachmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();



  if (!session?.user?.id) {
    return redirect('/login');
  }

  const canViewAll =
    (await requirePermission(session.user.id, "attachments.view_all")) ||
    (await requirePermission(session.user.id, "reports.view_all"));
  const canEdit = await requirePermission(session.user.id, "attachments.edit");
  if (!canViewAll) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Attachments</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to attachments.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let attachments: Array<{
    id: string;
    type: string;
    recordId: string;
    fileName: string;
    fileUrl: string;
    createdAt: Date;
  }> = [];
  let total = 0;
  try {
    const where: import("@prisma/client").Prisma.AttachmentWhereInput = search
      ? {
          OR: [
            { type: { contains: search, mode: "insensitive" as const } },
            { recordId: { contains: search, mode: "insensitive" as const } },
            { fileName: { contains: search, mode: "insensitive" as const } },
            { fileUrl: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [attachmentsResult, totalResult] = await Promise.all([
      prisma.attachment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.attachment.count({ where }),
    ]);
    attachments = attachmentsResult;
    total = totalResult;
  } catch (error) {
    console.error("Error fetching attachments:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Attachments</h1>
        <p className="mt-2 text-muted-foreground">Error loading attachment data. Please try again later.</p>
      </div>
    );
  }
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Attachments</h1>
            <p className="mt-2 text-muted-foreground">External links and file metadata.</p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search attachments..." />
          </div>
        </div>
      </div>

      {canEdit ? <AttachmentForm /> : null}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Type</th>
                <th className="py-2">Record</th>
                <th className="py-2">File</th>
                <th className="py-2">Preview</th>
                <th className="py-2">URL</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.type}</td>
                  <td className="py-2">{item.recordId}</td>
                  <td className="py-2">{item.fileName}</td>
                  <td className="py-2">
                    {/\.(png|jpe?g|gif|webp)$/i.test(item.fileUrl) ? (
                      <img
                        src={item.fileUrl}
                        alt={item.fileName}
                        className="h-10 w-10 rounded border object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <a className="text-blue-600" href={item.fileUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </td>
                  <td className="py-2">
                    <AttachmentActions attachment={item} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {attachments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No attachments found.</div>
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
