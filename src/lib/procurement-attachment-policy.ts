import { validateAttachmentFormat } from "@/lib/document-attachment-policy";

type ProcurementAttachmentType = "purchase_order" | "goods_receipt" | "vendor_bill" | "vendor_payment";

const LOCKED_STATUS_BY_TYPE: Record<ProcurementAttachmentType, Set<string>> = {
  purchase_order: new Set(["CANCELLED"]),
  goods_receipt: new Set(["POSTED", "RECEIVED", "PARTIAL", "VOID"]),
  vendor_bill: new Set(["POSTED", "VOID"]),
  vendor_payment: new Set(["POSTED", "VOID"]),
};

export function isProcurementAttachmentLocked(
  type: ProcurementAttachmentType,
  status: string | null | undefined,
): boolean {
  const normalized = String(status || "").toUpperCase();
  if (!normalized) return false;
  return LOCKED_STATUS_BY_TYPE[type].has(normalized);
}

export function procurementAttachmentLockMessage(label: string, status: string | null | undefined): string {
  const normalized = String(status || "").toUpperCase();
  return `Attachments are locked because ${label} is in ${normalized || "UNKNOWN"} status.`;
}

export function validateProcurementAttachmentFormat(fileName: string, mimeType?: string | null): string | null {
  return validateAttachmentFormat(fileName, mimeType);
}
