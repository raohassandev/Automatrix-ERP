import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";

test.describe.serial("Inventory identity guards", () => {
  test("blocks canonical-name and SKU duplicates, returns similar items", async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL);

    const unique = Date.now();
    const baseName = `E2E Canon Item ${unique}`;
    const baseSku = `E2E-CAN-${unique}`;
    const createdIds: string[] = [];

    const createItem = async (payload: {
      name: string;
      sku: string;
      category?: string;
      unit?: string;
      unitCost?: number;
      sellingPrice?: number;
      initialQuantity?: number;
    }) => {
      return page.request.post("/api/inventory", {
        data: {
          category: payload.category ?? "E2E",
          unit: payload.unit ?? "pcs",
          unitCost: payload.unitCost ?? 100,
          sellingPrice: payload.sellingPrice ?? 150,
          initialQuantity: payload.initialQuantity ?? 1,
          minStock: 0,
          reorderQty: 0,
          ...payload,
        },
      });
    };

    try {
      const createRes = await createItem({ name: baseName, sku: baseSku });
      expect(createRes.ok()).toBeTruthy();
      const createJson = await createRes.json();
      expect(createJson?.data?.id).toBeTruthy();
      const createdId = String(createJson.data.id);
      createdIds.push(createdId);

      const duplicateNameRes = await createItem({
        name: ` e2e   canon-item ${unique} `,
        sku: `E2E-OTHER-${unique}`,
      });
      expect(duplicateNameRes.status()).toBe(409);
      const duplicateNameJson = await duplicateNameRes.json();
      expect(String(duplicateNameJson?.error || "").toLowerCase()).toContain("similar item already exists");
      expect(String(duplicateNameJson?.duplicate?.id || "")).toBe(createdId);

      const duplicateSkuRes = await createItem({
        name: `E2E Totally Different ${unique}`,
        sku: baseSku.toLowerCase(),
      });
      expect(duplicateSkuRes.status()).toBe(409);
      const duplicateSkuJson = await duplicateSkuRes.json();
      expect(String(duplicateSkuJson?.error || "").toLowerCase()).toContain("sku already exists");
      expect(String(duplicateSkuJson?.duplicate?.id || "")).toBe(createdId);

      const similarRes = await page.request.get(
        `/api/inventory/similar?q=${encodeURIComponent(`canon item ${unique}`)}&limit=5`,
      );
      expect(similarRes.ok()).toBeTruthy();
      const similarJson = await similarRes.json();
      const ids = (similarJson?.data || []).map((row: { id: string }) => row.id);
      expect(ids).toContain(createdId);
    } finally {
      for (const id of createdIds) {
        await page.request.delete(`/api/inventory/${id}`, { timeout: 10_000 }).catch(() => null);
      }
    }
  });
});
