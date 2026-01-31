import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AttachmentForm from "@/components/AttachmentForm";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AttachmentsPage() {
  const session = await auth();



  if (!session?.user?.id) {
    return redirect('/login');
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  if (!canViewAll) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Attachments</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to attachments.</p>
      </div>
    );
  }

  const attachments = await prisma.attachment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Attachments</h1>
        <p className="mt-2 text-muted-foreground">External links and file metadata.</p>
      </div>

      <AttachmentForm />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Type</th>
                <th className="py-2">Record</th>
                <th className="py-2">File</th>
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
                    <a className="text-blue-600" href={item.fileUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <QuickEditButton
                        url={`/api/attachments/${item.id}`}
                        fields={{ fileName: "File Name", fileUrl: "File URL", type: "Type" }}
                      />
                      <DeleteButton url={`/api/attachments/${item.id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
