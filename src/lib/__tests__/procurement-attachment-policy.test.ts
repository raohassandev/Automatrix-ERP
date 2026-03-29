import { describe, expect, test } from "vitest";
import {
  isProcurementAttachmentLocked,
  procurementAttachmentLockMessage,
  validateProcurementAttachmentFormat,
} from "@/lib/procurement-attachment-policy";

describe("procurement attachment policy", () => {
  test("locks goods receipt attachments after posting lifecycle", () => {
    expect(isProcurementAttachmentLocked("goods_receipt", "APPROVED")).toBe(false);
    expect(isProcurementAttachmentLocked("goods_receipt", "POSTED")).toBe(true);
    expect(isProcurementAttachmentLocked("goods_receipt", "VOID")).toBe(true);
  });

  test("locks vendor bill/payment attachments once posted or void", () => {
    expect(isProcurementAttachmentLocked("vendor_bill", "APPROVED")).toBe(false);
    expect(isProcurementAttachmentLocked("vendor_bill", "POSTED")).toBe(true);
    expect(isProcurementAttachmentLocked("vendor_payment", "POSTED")).toBe(true);
    expect(isProcurementAttachmentLocked("vendor_payment", "VOID")).toBe(true);
  });

  test("keeps purchase order attachments editable except cancelled", () => {
    expect(isProcurementAttachmentLocked("purchase_order", "DRAFT")).toBe(false);
    expect(isProcurementAttachmentLocked("purchase_order", "ORDERED")).toBe(false);
    expect(isProcurementAttachmentLocked("purchase_order", "CANCELLED")).toBe(true);
  });

  test("formats lock message with status context", () => {
    expect(procurementAttachmentLockMessage("Vendor Bill", "POSTED")).toContain("Vendor Bill");
    expect(procurementAttachmentLockMessage("Vendor Bill", "POSTED")).toContain("POSTED");
  });

  test("validates allowed attachment extensions and mime types", () => {
    expect(validateProcurementAttachmentFormat("invoice.pdf", "application/pdf")).toBeNull();
    expect(validateProcurementAttachmentFormat("scan.png", "image/png")).toBeNull();
    expect(validateProcurementAttachmentFormat("note.txt", "text/plain")).toMatch(/Unsupported attachment type/i);
    expect(validateProcurementAttachmentFormat("invoice.pdf", "application/json")).toMatch(
      /Unsupported MIME type/i,
    );
  });
});
