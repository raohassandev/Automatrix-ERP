const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "xlsx", "docx"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpg",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateAttachmentFormat(fileName: string, mimeType?: string | null): string | null {
  const cleanName = String(fileName || "").trim().toLowerCase();
  const ext = cleanName.includes(".") ? cleanName.split(".").pop() || "" : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return "Unsupported attachment type. Allowed: pdf, jpg, jpeg, png, xlsx, docx.";
  }
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  if (normalizedMime && !ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return "Unsupported MIME type for attachment.";
  }
  return null;
}

export function isProjectAttachmentLocked(status: string | null | undefined): boolean {
  const normalized = String(status || "").toUpperCase();
  return ["CLOSED", "COMPLETED", "CANCELLED", "ARCHIVED"].includes(normalized);
}

export function isVendorAttachmentLocked(status: string | null | undefined): boolean {
  const normalized = String(status || "").toUpperCase();
  return normalized !== "" && normalized !== "ACTIVE";
}

export function isCompanyAccountAttachmentLocked(isActive: boolean | null | undefined): boolean {
  return isActive === false;
}

