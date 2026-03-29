import { describe, expect, test } from "vitest";
import {
  isCompanyAccountAttachmentLocked,
  isProjectAttachmentLocked,
  isVendorAttachmentLocked,
  validateAttachmentFormat,
} from "@/lib/document-attachment-policy";

describe("document attachment policy", () => {
  test("validates allowed extensions and mime types", () => {
    expect(validateAttachmentFormat("slip.pdf", "application/pdf")).toBeNull();
    expect(validateAttachmentFormat("sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBeNull();
    expect(validateAttachmentFormat("bad.exe", "application/octet-stream")).toMatch(/Unsupported attachment type/i);
    expect(validateAttachmentFormat("slip.pdf", "application/json")).toMatch(/Unsupported MIME type/i);
  });

  test("locks project attachments for closed lifecycle states", () => {
    expect(isProjectAttachmentLocked("ACTIVE")).toBe(false);
    expect(isProjectAttachmentLocked("CLOSED")).toBe(true);
    expect(isProjectAttachmentLocked("COMPLETED")).toBe(true);
  });

  test("locks vendor attachments unless vendor is active", () => {
    expect(isVendorAttachmentLocked("ACTIVE")).toBe(false);
    expect(isVendorAttachmentLocked("INACTIVE")).toBe(true);
  });

  test("locks company-account attachments when account inactive", () => {
    expect(isCompanyAccountAttachmentLocked(true)).toBe(false);
    expect(isCompanyAccountAttachmentLocked(false)).toBe(true);
  });
});

