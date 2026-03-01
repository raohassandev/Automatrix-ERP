import { test, expect, request } from "@playwright/test";

async function e2eLogin(page: import("@playwright/test").Page) {
  const email = process.env.E2E_TEST_EMAIL || "e2e-admin@automatrix.local";
  const password = process.env.E2E_TEST_PASSWORD || "e2e";

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "E2E Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("RB4 - Procurement chain", () => {
  test("PO -> GRN -> Vendor Bill -> Vendor Payment (posted) + inventory ledger", async ({ page, baseURL }) => {
    await e2eLogin(page);

    const storageState = await page.context().storageState();
    const api = await request.newContext({
      baseURL,
      storageState,
    });

    const ts = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    // 0) Client + Project (Phase 1 rule: projectRef required on procurement docs)
    const clientRes = await api.post("/api/clients", {
      data: { name: `E2E Client ${ts}` },
    });
    expect(clientRes.ok()).toBeTruthy();
    const clientJson = await clientRes.json();
    const clientId: string = clientJson.data.id;

    const projectRef = `PRJ-E2E-${ts}`;
    const projectRes = await api.post("/api/projects", {
      data: {
        projectId: projectRef,
        name: `E2E Project ${ts}`,
        clientId,
        startDate: today,
        status: "ACTIVE",
        contractValue: 0,
      },
    });
    expect(projectRes.ok()).toBeTruthy();

    // 1) Vendor
    const vendorRes = await api.post("/api/vendors", {
      data: {
        name: `E2E Vendor ${ts}`,
        status: "ACTIVE",
      },
    });
    expect(vendorRes.ok()).toBeTruthy();
    const vendorJson = await vendorRes.json();
    const vendorId: string = vendorJson.data.id;

    // 2) Inventory item (must exist for GRN stock-in)
    const itemName = `E2E Item ${ts}`;
    const invRes = await api.post("/api/inventory", {
      data: {
        name: itemName,
        sku: `E2E-SKU-${ts}`,
        category: "Material",
        unit: "pcs",
        unitCost: 100,
        sellingPrice: 150,
        initialQuantity: 0,
      },
    });
    expect(invRes.ok()).toBeTruthy();
    const invJson = await invRes.json();
    const itemId: string = invJson.data.id;

    // 3) Purchase Order (DRAFT)
    const poRes = await api.post("/api/procurement/purchase-orders", {
      data: {
        poNumber: `PO-E2E-${ts}`,
        vendorId,
        vendorName: `E2E Vendor ${ts}`,
        projectRef,
        orderDate: today,
        status: "DRAFT",
        currency: "PKR",
        items: [
          {
            itemName,
            unit: "pcs",
            quantity: 2,
            unitCost: 100,
          },
        ],
      },
    });
    expect(poRes.ok()).toBeTruthy();
    const poJson = await poRes.json();
    const poId: string = poJson.data.id;
    const poItemId: string = poJson.data.items[0].id;

    // 4) GRN (creates stock-in ledger rows)
    const grnRes = await api.post("/api/procurement/grn", {
      data: {
        grnNumber: `GRN-E2E-${ts}`,
        purchaseOrderId: poId,
        receivedDate: today,
        items: [
          {
            purchaseOrderItemId: poItemId,
            itemName,
            unit: "pcs",
            quantity: 2,
            unitCost: 100,
          },
        ],
      },
    });
    expect(grnRes.ok()).toBeTruthy();
    const grnJson = await grnRes.json();
    const grnId: string = grnJson.data.id;

    // GRN is DRAFT; post it through lifecycle to create inventory postings.
    for (const action of ["SUBMIT", "APPROVE", "POST"] as const) {
      const r = await api.patch(`/api/procurement/grn/${grnId}`, { data: { action } });
      expect(r.ok()).toBeTruthy();
    }

    // Inventory item quantity should be updated by GRN stock-in.
    const inventoryListRes = await api.get("/api/inventory");
    expect(inventoryListRes.ok()).toBeTruthy();
    const inventoryListJson = await inventoryListRes.json();
    const inventoryItems: Array<{ id: string; quantity?: number | string }> = inventoryListJson.data || [];
    const updatedItem = inventoryItems.find((it) => it.id === itemId);
    expect(updatedItem).toBeTruthy();
    expect(Number(updatedItem?.quantity)).toBeGreaterThanOrEqual(2);

    // 5) Vendor Bill (DRAFT -> SUBMITTED -> APPROVED -> POSTED)
    const billRes = await api.post("/api/procurement/vendor-bills", {
      data: {
        billNumber: `BILL-E2E-${ts}`,
        vendorId,
        projectRef,
        billDate: today,
        currency: "PKR",
        lines: [{ description: `Bill for ${itemName}`, total: 200 }],
      },
    });
    expect(billRes.ok()).toBeTruthy();
    const billJson = await billRes.json();
    const billId: string = billJson.data.id;

    for (const action of ["SUBMIT", "APPROVE", "POST"] as const) {
      const r = await api.patch(`/api/procurement/vendor-bills/${billId}`, { data: { action } });
      expect(r.ok()).toBeTruthy();
    }

    const billJournalRes = await api.get(`/api/accounting/journals?search=${encodeURIComponent(billId)}&take=10`);
    expect(billJournalRes.ok()).toBeTruthy();
    const billJournalJson = await billJournalRes.json();
    const billJournal = (billJournalJson.data || []).find(
      (row: { sourceType?: string; sourceId?: string }) => row.sourceType === "VENDOR_BILL" && row.sourceId === billId,
    );
    expect(billJournal).toBeTruthy();
    expect(Number(billJournal?.debit || 0)).toBeGreaterThan(0);
    expect(Number(billJournal?.debit || 0)).toBe(Number(billJournal?.credit || 0));

    // 6) Company account (use existing default)
    const accountsRes = await api.get("/api/company-accounts");
    expect(accountsRes.ok()).toBeTruthy();
    const accountsJson = await accountsRes.json();
    const accounts: Array<{ id: string; name: string }> = accountsJson.data || [];
    let companyAccountId: string | null = accounts[0]?.id ?? null;
    if (!companyAccountId) {
      const createAccountRes = await api.post("/api/company-accounts", {
        data: {
          name: `E2E Account ${ts}`,
          type: "BANK",
          currency: "PKR",
          openingBalance: 0,
          isActive: true,
        },
      });
      expect(createAccountRes.ok()).toBeTruthy();
      const createAccountJson = await createAccountRes.json();
      companyAccountId = createAccountJson.data.id;
    }
    expect(companyAccountId).toBeTruthy();

    // 7) Vendor Payment (DRAFT -> SUBMITTED -> APPROVED -> POSTED)
    const payRes = await api.post("/api/procurement/vendor-payments", {
      data: {
        paymentNumber: `PAY-E2E-${ts}`,
        vendorId,
        projectRef,
        paymentDate: today,
        companyAccountId: companyAccountId!,
        method: "Bank Transfer",
        amount: 200,
        allocations: [{ vendorBillId: billId, amount: 200 }],
      },
    });
    expect(payRes.ok()).toBeTruthy();
    const payJson = await payRes.json();
    const payId: string = payJson.data.id;

    for (const action of ["SUBMIT", "APPROVE", "POST"] as const) {
      const r = await api.patch(`/api/procurement/vendor-payments/${payId}`, { data: { action } });
      expect(r.ok()).toBeTruthy();
    }

    const paymentJournalRes = await api.get(`/api/accounting/journals?search=${encodeURIComponent(payId)}&take=10`);
    expect(paymentJournalRes.ok()).toBeTruthy();
    const paymentJournalJson = await paymentJournalRes.json();
    const paymentJournal = (paymentJournalJson.data || []).find(
      (row: { sourceType?: string; sourceId?: string }) =>
        row.sourceType === "VENDOR_PAYMENT" && row.sourceId === payId,
    );
    expect(paymentJournal).toBeTruthy();
    expect(Number(paymentJournal?.debit || 0)).toBe(Number(paymentJournal?.credit || 0));

    // Bill should now have outstanding ~0.
    const billGet = await api.get(`/api/procurement/vendor-bills/${billId}`);
    expect(billGet.ok()).toBeTruthy();
    const billGetJson = await billGet.json();
    expect(Number(billGetJson.data.outstandingAmount)).toBe(0);

    const reconRes = await api.get("/api/reports/accounting/reconciliation");
    expect(reconRes.ok()).toBeTruthy();
    const reconJson = await reconRes.json();
    expect(reconJson?.data?.checks?.trialBalanceBalanced).toBeTruthy();

    await api.dispose();
  });

  test("Negative: expense stock-in attempt is rejected (Phase 1 single-spine)", async ({ page, baseURL }) => {
    await e2eLogin(page);

    const storageState = await page.context().storageState();
    const api = await request.newContext({
      baseURL,
      storageState,
    });

    const today = new Date().toISOString().slice(0, 10);

    // Any attempt to use expense payload to touch stock must be blocked server-side.
    const res = await api.post("/api/expenses", {
      data: {
        date: today,
        description: "E2E blocked expense stock-in",
        category: "Material (Stock/Inventory)",
        amount: 1,
        paymentMode: "Cash",
        project: "General Office",
        // Blocked keys (Phase 1): must be rejected before validation.
        inventoryItemId: "not-a-uuid",
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBeFalsy();
    expect(String(body.error || "")).toContain("Stock purchases are not allowed in Expenses");

    await api.dispose();
  });
});
