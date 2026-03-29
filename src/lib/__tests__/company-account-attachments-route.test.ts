import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockCompanyAccountFindUnique = vi.fn();
const mockAttachmentCreate = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    companyAccount: {
      findUnique: mockCompanyAccountFindUnique,
    },
    attachment: {
      create: mockAttachmentCreate,
    },
  },
}));

describe("company-account attachments route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u-1" } });
    mockRequirePermission.mockResolvedValue(true);
    mockCompanyAccountFindUnique.mockResolvedValue({ id: "acc-1", isActive: true });
    mockAttachmentCreate.mockResolvedValue({
      id: "att-1",
      fileName: "statement.pdf",
      fileUrl: "https://files.test/statement.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/company-accounts/[id]/attachments/route");
    const req = new Request("http://localhost/api/company-accounts/acc-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.pdf", url: "https://f/a.pdf" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "acc-1" }) });
    expect(res.status).toBe(401);
  });

  test("returns 403 when user lacks permission", async () => {
    mockRequirePermission.mockResolvedValue(false);
    const { POST } = await import("@/app/api/company-accounts/[id]/attachments/route");
    const req = new Request("http://localhost/api/company-accounts/acc-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.pdf", url: "https://f/a.pdf" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "acc-1" }) });
    expect(res.status).toBe(403);
  });

  test("returns 400 and audits when account is inactive", async () => {
    mockCompanyAccountFindUnique.mockResolvedValue({ id: "acc-1", isActive: false });
    const { POST } = await import("@/app/api/company-accounts/[id]/attachments/route");
    const req = new Request("http://localhost/api/company-accounts/acc-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.pdf", url: "https://f/a.pdf" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "acc-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(String(json.error || "")).toMatch(/locked/i);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BLOCK_COMPANY_ACCOUNT_ATTACHMENT_LOCKED",
        entity: "CompanyAccount",
        entityId: "acc-1",
      }),
    );
  });

  test("returns 400 for unsupported file format", async () => {
    const { POST } = await import("@/app/api/company-accounts/[id]/attachments/route");
    const req = new Request("http://localhost/api/company-accounts/acc-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "malware.exe", url: "https://f/malware.exe" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "acc-1" }) });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(String(json.error || "")).toMatch(/unsupported attachment type/i);
  });

  test("creates attachment and writes audit for valid payload", async () => {
    const { POST } = await import("@/app/api/company-accounts/[id]/attachments/route");
    const req = new Request("http://localhost/api/company-accounts/acc-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "statement.pdf",
        url: "https://files.test/statement.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "acc-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("att-1");
    expect(mockAttachmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "company_account",
          recordId: "acc-1",
          fileName: "statement.pdf",
        }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "COMPANY_ACCOUNT_ATTACHMENT_ADD",
        entity: "CompanyAccount",
        entityId: "acc-1",
      }),
    );
  });
});
