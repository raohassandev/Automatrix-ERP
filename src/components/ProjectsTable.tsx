"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { DeleteButton } from "@/components/TableActions";
import { MobileCard } from "@/components/MobileCard";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/ProjectFormDialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";

interface ProjectRow {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  clientId: string;
  status: string;
  contractValue: number;
  pendingRecovery: number;
  startDate: string;
  endDate?: string | null;
}

export function ProjectsTable({
  projects,
  canEdit,
  canViewFinancials,
}: {
  projects: ProjectRow[];
  canEdit: boolean;
  canViewFinancials: boolean;
}) {
  const router = useRouter();
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    project?: ProjectRow;
  }>({ open: false });

  const openEditDialog = (project: ProjectRow) => {
    setEditDialog({ open: true, project });
  };

  return (
    <>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Project</th>
                <th className="py-2">Client</th>
                <th className="py-2">Status</th>
                {canViewFinancials ? <th className="py-2">Contract</th> : null}
                {canViewFinancials ? <th className="py-2">Pending</th> : null}
                {canEdit ? <th className="py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b cursor-pointer hover:bg-accent/40"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <td className="py-2 font-medium">
                    <Link
                      href={`/projects/${project.id}`}
                      className="underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="py-2">{project.clientName || "-"}</td>
                  <td className="py-2">
                    <StatusBadge status={project.status} />
                  </td>
                  {canViewFinancials ? (
                    <td className="py-2">{formatMoney(Number(project.contractValue))}</td>
                  ) : null}
                  {canViewFinancials ? (
                    <td className="py-2">{formatMoney(Number(project.pendingRecovery))}</td>
                  ) : null}
                  {canEdit ? (
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(project);
                          }}
                        >
                          Edit
                        </Button>
                        <div onClick={(e) => e.stopPropagation()}>
                          <DeleteButton url={`/api/projects/${project.id}`} />
                        </div>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {projects.map((project) => (
            <MobileCard
              key={project.id}
              title={project.name}
              subtitle={project.clientName || "-"}
              href={`/projects/${project.id}`}
              fields={[
                { label: "Status", value: <StatusBadge status={project.status} /> },
                ...(canViewFinancials
                  ? [
                      { label: "Contract", value: formatMoney(Number(project.contractValue)) },
                      { label: "Pending", value: formatMoney(Number(project.pendingRecovery)) },
                    ]
                  : []),
              ]}
              actions={
                canEdit ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(project)}
                    >
                      Edit
                    </Button>
                    <DeleteButton url={`/api/projects/${project.id}`} />
                  </>
                ) : null
              }
            />
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No projects found.</div>
        )}
      </div>

      <ProjectFormDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, project: editDialog.project })}
        initialData={
          editDialog.project
            ? {
                id: editDialog.project.id,
                projectId: editDialog.project.projectId,
                name: editDialog.project.name,
                clientId: editDialog.project.clientId,
                startDate: editDialog.project.startDate,
                endDate: editDialog.project.endDate || undefined,
                contractValue: String(editDialog.project.contractValue),
                status: editDialog.project.status,
              }
            : undefined
        }
        onCreated={() => {
          // Parent page will refresh on navigation; keep dialog local.
        }}
      />
    </>
  );
}
