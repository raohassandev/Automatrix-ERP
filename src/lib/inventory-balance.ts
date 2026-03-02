import { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getWarehouseItemQuantity(
  db: DbClient,
  itemId: string,
  warehouseId: string,
): Promise<number> {
  const aggregate = await db.inventoryLedger.aggregate({
    where: { itemId, warehouseId },
    _sum: { quantity: true },
  });
  return Number(aggregate._sum.quantity || 0);
}

