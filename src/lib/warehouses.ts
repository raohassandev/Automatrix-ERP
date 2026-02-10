import { Prisma } from "@prisma/client";

// Phase 1 default behavior:
// - We operate as "single warehouse" but keep the model to avoid refactors later.
// - We must not break existing real data, so ledger.warehouseId is nullable.
export async function ensureDefaultWarehouseId(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.warehouse.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const created = await tx.warehouse.create({
    data: { name: "Main Warehouse", code: "MAIN", isDefault: true, isActive: true },
  });
  return created.id;
}
