import { expect, request, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";

test.describe("Procurement + Inventory control guards", () => {
  test("blocks GRN on non-receivable PO, blocks duplicate bill, blocks over-transfer by warehouse", async ({
    page,
    baseURL,
  }) => {
    await loginAs(page, FINANCE_EMAIL);
    const storage = await page.context().storageState();
    const api = await request.newContext({ baseURL, storageState: storage, ignoreHTTPSErrors: true });

    const now = Date.now();

    const projectsRes = await api.get("/api/projects");
    expect(projectsRes.ok()).toBeTruthy();
    const projectsJson = await projectsRes.json();
    const projectRef = projectsJson?.data?.[0]?.projectId as string | undefined;
    expect(projectRef).toBeTruthy();

    const vendorCreate = await api.post("/api/vendors", {
      data: {
        name: `E2E Vendor Controls ${now}`,
        contactName: "Control QA",
        phone: "03000000000",
        email: `vendor-controls-${now}@example.com`,
      },
    });
    expect(vendorCreate.ok()).toBeTruthy();
    const vendorId = (await vendorCreate.json())?.data?.id as string;
    expect(vendorId).toBeTruthy();

    const poCreate = await api.post("/api/procurement/purchase-orders", {
      data: {
        poNumber: `PO-CTRL-${now}`,
        vendorId,
        vendorName: `E2E Vendor Controls ${now}`,
        projectRef,
        orderDate: new Date().toISOString().slice(0, 10),
        items: [{ itemName: "Cable", unit: "pcs", quantity: 5, unitCost: 1000 }],
      },
    });
    expect(poCreate.ok()).toBeTruthy();
    const poId = (await poCreate.json())?.data?.id as string;
    expect(poId).toBeTruthy();

    const grnOnDraftPo = await api.post("/api/procurement/grn", {
      data: {
        grnNumber: `GRN-CTRL-${now}`,
        purchaseOrderId: poId,
        receivedDate: new Date().toISOString().slice(0, 10),
        items: [{ itemName: "Cable", unit: "pcs", quantity: 1, unitCost: 1000 }],
      },
    });
    expect(grnOnDraftPo.status()).toBe(400);

    const billNumberA = `VB-CTRL-A-${now}`;
    const billCreateA = await api.post("/api/procurement/vendor-bills", {
      data: {
        billNumber: billNumberA,
        vendorId,
        projectRef,
        billDate: new Date().toISOString().slice(0, 10),
        currency: "PKR",
        lines: [{ description: "Service", quantity: 1, unit: "job", unitCost: 5000 }],
      },
    });
    expect(billCreateA.ok()).toBeTruthy();

    const billCreateB = await api.post("/api/procurement/vendor-bills", {
      data: {
        billNumber: `VB-CTRL-B-${now}`,
        vendorId,
        projectRef,
        billDate: new Date().toISOString().slice(0, 10),
        currency: "PKR",
        lines: [{ description: "Service", quantity: 1, unit: "job", unitCost: 5000 }],
      },
    });
    expect(billCreateB.status()).toBe(409);

    const itemCreate = await api.post("/api/inventory", {
      data: {
        name: `E2E Control Item ${now}`,
        category: "E2E",
        unit: "pcs",
        sku: `CTRL-${now}`,
        sellingPrice: 0,
        unitCost: 100,
      },
    });
    expect(itemCreate.ok()).toBeTruthy();
    const itemId = (await itemCreate.json())?.data?.id as string;
    expect(itemId).toBeTruthy();

    const warehousesRes = await api.get("/api/warehouses");
    expect(warehousesRes.ok()).toBeTruthy();
    const warehousesJson = await warehousesRes.json();
    let warehouses = (warehousesJson?.data || []) as Array<{ id: string; name: string }>;

    while (warehouses.length < 2) {
      const addRes = await api.post("/api/warehouses", {
        data: {
          name: `E2E-WH-${now}-${warehouses.length + 1}`,
          code: `E2E${now}${warehouses.length + 1}`,
        },
      });
      expect(addRes.ok()).toBeTruthy();
      const fresh = await api.get("/api/warehouses");
      expect(fresh.ok()).toBeTruthy();
      warehouses = ((await fresh.json())?.data || []) as Array<{ id: string; name: string }>;
    }

    const whA = warehouses[0].id;
    const whB = warehouses[1].id;

    const stockIn = await api.post("/api/inventory/ledger", {
      data: { itemId, type: "ADJUSTMENT", warehouseId: whA, quantity: 2, unitCost: 100, reference: `ADJ-${now}` },
    });
    expect(stockIn.ok()).toBeTruthy();

    const overTransfer = await api.post("/api/inventory/transfer", {
      data: {
        itemId,
        fromWarehouseId: whA,
        toWarehouseId: whB,
        quantity: 5,
        reference: `TRF-${now}`,
      },
    });
    expect(overTransfer.status()).toBe(400);

    await api.dispose();
  });
});
