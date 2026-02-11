import { hasPermission, type RoleName } from "@/lib/permissions";

export type ProjectWorkhubAction =
  | "create_po"
  | "receive_grn"
  | "create_vendor_bill"
  | "assign_people"
  | "add_note"
  | "add_attachment";

export type ProjectWorkhubPolicy = {
  role: RoleName;
  actions: Record<ProjectWorkhubAction, boolean>;
};

export function buildProjectWorkhubPolicy(role: RoleName): ProjectWorkhubPolicy {
  const canProcure = hasPermission(role, "procurement.edit") && hasPermission(role, "procurement.view_all");
  const canAssign = hasPermission(role, "projects.assign");

  // Phase 1 default: notes/attachments are broadly allowed for users who can access the project,
  // but server-side APIs must still enforce project scope.
  const canAddNotes = hasPermission(role, "projects.view_all") || hasPermission(role, "projects.view_assigned");

  // Engineer/PM and Store/Technician/Sales/Marketing: restricted to notes/attachments (and assignments if allowed).
  const actions: Record<ProjectWorkhubAction, boolean> = {
    create_po: canProcure,
    receive_grn: canProcure,
    create_vendor_bill: canProcure,
    assign_people: canAssign,
    add_note: canAddNotes,
    add_attachment: canAddNotes,
  };

  return { role, actions };
}

