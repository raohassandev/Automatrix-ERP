import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjectDetailForUser } from "@/lib/project-detail-policy";
import { ProjectDetailClient } from "./ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getProjectDetailForUser({ userId: session.user.id, projectDbId: id });

  if (!result.ok) {
    if (result.status === 404) {
      return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Project</h1>
          <p className="mt-2 text-muted-foreground">Project not found.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Project</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this project.</p>
      </div>
    );
  }

  return <ProjectDetailClient detail={result.data} />;
}

