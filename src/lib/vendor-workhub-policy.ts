import { hasPermission, type RoleName } from "@/lib/permissions";

export type VendorWorkhubAction =
  | "create_po"
  | "create_vendor_bill"
  | "record_vendor_payment"
  | "add_note"
  | "add_attachment";

export type VendorWorkhubPolicy = {
  role: RoleName;
  actions: Record<VendorWorkhubAction, boolean>;
};

function isFinanceRole(role: RoleName) {
  return (
    role === "Finance Manager" ||
    role === "Accountant" ||
    role === "CFO" ||
    role === "Admin" ||
    role === "Owner" ||
    role === "CEO"
  );
}

export function buildVendorWorkhubPolicy(role: RoleName): VendorWorkhubPolicy {
  const canProcure = hasPermission(role, "procurement.edit") && hasPermission(role, "procurement.view_all");
  const canAddNotes = hasPermission(role, "vendors.view_all") || hasPermission(role, "procurement.view_all") || hasPermission(role, "projects.view_assigned") || hasPermission(role, "projects.view_all");

  const actions: Record<VendorWorkhubAction, boolean> = {
    create_po: canProcure,
    create_vendor_bill: canProcure,
    record_vendor_payment: isFinanceRole(role) && hasPermission(role, "procurement.edit"),
    add_note: canAddNotes,
    add_attachment: canAddNotes,
  };

  return { role, actions };
}

