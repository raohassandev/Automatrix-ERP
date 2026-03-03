import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { normalizeInventoryName, normalizeSku } from "@/lib/inventory-identity";

type ImportRow = {
  name?: string;
  sku?: string | null;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canAdjust = await requirePermission(session.user.id, "inventory.adjust");
  if (!canAdjust) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? (body.rows as ImportRow[]) : [];
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "rows[] is required" }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ success: false, error: "Maximum 2000 rows allowed per validation request." }, { status: 400 });
  }

  const canonicalSet = new Set<string>();
  const skuSet = new Set<string>();
  const conflicts: Array<{
    row: number;
    field: "name" | "sku";
    type: "missing_name" | "in_file_duplicate" | "existing_duplicate";
    message: string;
    existing?: { id: string; name: string; sku: string | null };
  }> = [];

  const normalizedRows = rows.map((row, index) => {
    const name = String(row?.name || "").trim();
    const canonicalName = normalizeInventoryName(name);
    const sku = normalizeSku(row?.sku);
    const rowNo = index + 2;

    if (!canonicalName) {
      conflicts.push({
        row: rowNo,
        field: "name",
        type: "missing_name",
        message: "Item name is empty or invalid.",
      });
    }

    if (canonicalName) {
      if (canonicalSet.has(canonicalName)) {
        conflicts.push({
          row: rowNo,
          field: "name",
          type: "in_file_duplicate",
          message: "Duplicate item name found in import file.",
        });
      }
      canonicalSet.add(canonicalName);
    }

    if (sku) {
      if (skuSet.has(sku)) {
        conflicts.push({
          row: rowNo,
          field: "sku",
          type: "in_file_duplicate",
          message: "Duplicate SKU found in import file.",
        });
      }
      skuSet.add(sku);
    }

    return { rowNo, name, canonicalName, sku };
  });

  const [existingByCanonical, existingBySku] = await Promise.all([
    canonicalSet.size
      ? prisma.inventoryItem.findMany({
          where: { canonicalName: { in: Array.from(canonicalSet) } },
          select: { id: true, name: true, sku: true, canonicalName: true },
        })
      : Promise.resolve([]),
    skuSet.size
      ? prisma.inventoryItem.findMany({
          where: { sku: { in: Array.from(skuSet) } },
          select: { id: true, name: true, sku: true },
        })
      : Promise.resolve([]),
  ]);

  const canonicalMap = new Map(existingByCanonical.map((item) => [item.canonicalName, item]));
  const skuMap = new Map(existingBySku.filter((item) => item.sku).map((item) => [String(item.sku).toUpperCase(), item]));

  for (const row of normalizedRows) {
    if (row.canonicalName) {
      const sameName = canonicalMap.get(row.canonicalName);
      if (sameName) {
        conflicts.push({
          row: row.rowNo,
          field: "name",
          type: "existing_duplicate",
          message: "Similar name already exists in inventory.",
          existing: { id: sameName.id, name: sameName.name, sku: sameName.sku || null },
        });
      }
    }
    if (row.sku) {
      const sameSku = skuMap.get(row.sku);
      if (sameSku) {
        conflicts.push({
          row: row.rowNo,
          field: "sku",
          type: "existing_duplicate",
          message: "SKU already exists in inventory.",
          existing: { id: sameSku.id, name: sameSku.name, sku: sameSku.sku || null },
        });
      }
    }
  }

  const validRows = normalizedRows.length - new Set(conflicts.map((c) => c.row)).size;
  return NextResponse.json({
    success: true,
    summary: {
      totalRows: normalizedRows.length,
      validRows,
      conflictRows: normalizedRows.length - validRows,
      totalConflicts: conflicts.length,
    },
    conflicts,
  });
}

