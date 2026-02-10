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

    // 6) Company account (use existing default)
    const accountsRes = await api.get("/api/company-accounts");
    expect(accountsRes.ok()).toBeTruthy();
    const accountsJson = await accountsRes.json();
    const accounts: Array<{ id: string; name: string }> = accountsJson.data || [];
    expect(accounts.length).toBeGreaterThan(0);
    const companyAccountId = accounts[0].id;

    // 7) Vendor Payment (DRAFT -> SUBMITTED -> APPROVED -> POSTED)
    const payRes = await api.post("/api/procurement/vendor-payments", {
      data: {
        paymentNumber: `PAY-E2E-${ts}`,
        vendorId,
        paymentDate: today,
        companyAccountId,
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

    // Bill should now have outstanding ~0.
    const billGet = await api.get(`/api/procurement/vendor-bills/${billId}`);
    expect(billGet.ok()).toBeTruthy();
    const billGetJson = await billGet.json();
    expect(Number(billGetJson.data.outstandingAmount)).toBe(0);

    await api.dispose();
  });
});
