import { describe, expect, test } from "vitest";
import { expenseSchema, incomeSchema } from "../validation";

describe("validation schemas (business rules)", () => {
  test("expenseSchema: accepts a valid expense payload", () => {
    const payload = {
      date: new Date().toISOString(),
      description: "Fuel for project vehicle",
      category: "Fuel",
      amount: 1000,
      paymentMode: "Cash",
      paymentSource: "COMPANY_DIRECT" as const,
      project: "P-001",
    };

    const parsed = expenseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  test("expenseSchema: rejects null for optional fields (must be undefined/omitted)", () => {
    const payload = {
      date: new Date().toISOString(),
      description: "Fuel",
      category: "Fuel",
      amount: 1000,
      paymentMode: "Cash",
      paymentSource: null,
      receiptUrl: null,
      receiptFileId: null,
      remarks: null,
      categoryRequest: null,
      project: "P-001",
    } as unknown;

    const parsed = expenseSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  test("expenseSchema: allows empty project (treated as optional)", () => {
    const payload = {
      date: new Date().toISOString(),
      description: "Misc",
      category: "General",
      amount: 1,
      paymentMode: "Cash",
      project: "",
    };

    const parsed = expenseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  test("incomeSchema: project is optional and may be omitted", () => {
    const payload = {
      date: new Date().toISOString(),
      source: "Client payment",
      amount: 5000,
      paymentMode: "Bank Transfer",
      companyAccountId: "acc_123",
    };

    const parsed = incomeSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  test("incomeSchema: requires companyAccountId for account-linked inflow tracking", () => {
    const payload = {
      date: new Date().toISOString(),
      source: "Client payment",
      amount: 5000,
      paymentMode: "Bank Transfer",
    };

    const parsed = incomeSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  test("incomeSchema: rejects invalid receiptUrl", () => {
    const payload = {
      date: new Date().toISOString(),
      source: "Client payment",
      amount: 5000,
      paymentMode: "Bank Transfer",
      companyAccountId: "acc_123",
      receiptUrl: "not-a-url",
    };

    const parsed = incomeSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
