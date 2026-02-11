import { hasPermission, type RoleName } from "@/lib/permissions";

export type ItemWorkhubAction = "start_po_with_item" | "add_note" | "add_attachment";

export type ItemWorkhubPolicy = {
  role: RoleName;
  actions: Record<ItemWorkhubAction, boolean>;
};

export function buildItemWorkhubPolicy(role: RoleName): ItemWorkhubPolicy {
  const canProcure = hasPermission(role, "procurement.edit") && hasPermission(role, "procurement.view_all");
  const canAddNotes = hasPermission(role, "inventory.view") || hasPermission(role, "inventory.view_selling");

  const actions: Record<ItemWorkhubAction, boolean> = {
    start_po_with_item: canProcure,
    add_note: canAddNotes,
    add_attachment: canAddNotes,
  };

  return { role, actions };
}

