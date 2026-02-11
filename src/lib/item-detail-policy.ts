import { prisma } from "@/lib/prisma";
import { getUserRoleName } from "@/lib/rbac";
import { hasPermission, RoleName } from "@/lib/permissions";

export type ItemDetailTab = "activity" | "ledger" | "onhand" | "documents";

export type ItemDetailPolicy = {
  role: RoleName;
  canAccessPage: boolean;
  tabs: Record<ItemDetailTab, boolean>;
  canViewUnitCosts: boolean;
};

export type ItemDetailHeader = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  status: string;
  reorderLevel: number | null;
  minStock: number | null;
  availableQty: number;
};

export type ItemActivityRow = {
  at: string; // ISO
  label: string;
  type: string;
  quantity: number;
  href?: string | null;
  amount?: number | null;
};

export type ItemLedgerRow = {
  id: string;
  date: string;
  type: string;
  quantity: number;
  reference: string | null;
  project: string | null;
  warehouse: string | null;
  href?: string | null;
  unitCost?: number | null;
  total?: number | null;
};

export type ItemOnHandRow = {
  warehouseId: string | null;
  warehouseName: string;
  quantity: number;
  value?: number;
};

export type ItemDocumentRow = {
  type: string;
  number: string;
  date: string;
  href: string;
};

export type ItemNotesHistoryRow = {
  at: string; // ISO
  action: "ITEM_NOTE_ADD" | "ITEM_ATTACHMENT_ADD";
  note?: string | null;
  attachment?: { fileName: string; url: string } | null;
};

export type ItemDetailData = {
  header: ItemDetailHeader;
  policy: ItemDetailPolicy;
  activity: ItemActivityRow[];
  notesHistory: ItemNotesHistoryRow[];
  ledger: {
    entries: ItemLedgerRow[];
    page: number;
    totalPages: number;
    totalCount: number;
  };
  onHand: ItemOnHandRow[];
  documents: ItemDocumentRow[];
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function iso(d: Date) {
  return d.toISOString();
}

function buildPolicy(role: RoleName): ItemDetailPolicy {
  const canAccessPage = hasPermission(role, "inventory.view");
  const canViewUnitCosts = hasPermission(role, "inventory.view_cost");

  const isSalesOrMarketing = role === "Sales" || role === "Marketing";
  const isStoreOrTech = role === "Store Keeper" || role === "Staff";
  const isEngineer = role === "Engineering";

  const tabs: Record<ItemDetailTab, boolean> = {
    activity: canAccessPage && !isSalesOrMarketing,
    ledger: canAccessPage && !isSalesOrMarketing,
    onhand: canAccessPage,
    documents: canAccessPage && !isSalesOrMarketing,
  };

  // Sales/Marketing: availability-only view in Phase 1.
  if (isSalesOrMarketing) {
    tabs.activity = false;
    tabs.ledger = false;
    tabs.documents = false;
    tabs.onhand = canAccessPage;
  }

  // Store/Technician/Engineer: can see activity/ledger, but no costs.
  if (isStoreOrTech || isEngineer) {
    // keep default tabs
  }

  return { role, canAccessPage, tabs, canViewUnitCosts };
}

async function getAssignedProjectRefs(userId: string) {
  const rows = await prisma.projectAssignment.findMany({
    where: { userId },
    select: { project: { select: { projectId: true } } },
  });
  return Array.from(new Set(rows.map((r) => r.project.projectId).filter(Boolean)));
}

function buildHrefFromReference(ref: string | null) {
  if (!ref) return null;
  const r = String(ref);
  if (r.startsWith("GRN-")) return `/procurement/grn?search=${encodeURIComponent(r)}`;
  if (r.startsWith("PO-")) return `/procurement/purchase-orders?search=${encodeURIComponent(r)}`;
  if (r.startsWith("BILL-")) return `/procurement/vendor-bills?search=${encodeURIComponent(r)}`;
  if (r.startsWith("PAY-")) return `/procurement/vendor-payments?search=${encodeURIComponent(r)}`;
  return null;
}

export async function getItemDetailForUser(args: {
  userId: string;
  itemDbId: string;
  ledgerPage: number;
}) {
  const role = await getUserRoleName(args.userId);
  const policy = buildPolicy(role);
  if (!policy.canAccessPage) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: args.itemDbId },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      unit: true,
      minStock: true,
      reorderQty: true,
      availableQty: true,
      quantity: true,
      unitCost: policy.canViewUnitCosts ? true : false,
      totalValue: policy.canViewUnitCosts ? true : false,
    },
  });
  if (!item) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  // Scope: Engineering can see ledger/activity only for assigned projects (when project field is used).
  const isEngineer = policy.role === "Engineering";
  const assignedProjectRefs = isEngineer ? await getAssignedProjectRefs(args.userId) : null;
  const ledgerWhere: import("@prisma/client").Prisma.InventoryLedgerWhereInput = {
    itemId: item.id,
    ...(assignedProjectRefs
      ? {
          OR: [{ project: { in: assignedProjectRefs } }, { project: null }],
        }
      : {}),
  };

  const take = 25;
  const page = Math.max(args.ledgerPage, 1);
  const skip = (page - 1) * take;

  const ledgerSelect: Record<string, unknown> = {
    id: true,
    date: true,
    type: true,
    quantity: true,
    reference: true,
    project: true,
    warehouse: { select: { name: true } },
  };
  if (policy.canViewUnitCosts) {
    ledgerSelect.unitCost = true;
    ledgerSelect.total = true;
  }

  type LedgerRow = {
    id: string;
    date: Date;
    type: string;
    quantity: unknown;
    reference: string | null;
    project: string | null;
    unitCost?: unknown;
    total?: unknown;
    warehouse: { name: string } | null;
  };

  const [ledgerRows, ledgerCount] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where: ledgerWhere,
      orderBy: { date: "desc" },
      select: ledgerSelect as never,
      skip,
      take,
    }) as unknown as LedgerRow[],
    prisma.inventoryLedger.count({ where: ledgerWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(ledgerCount / take));

  const ledgerEntries: ItemLedgerRow[] = ledgerRows.map((r) => ({
    id: r.id,
    date: fmtDate(r.date),
    type: r.type,
    quantity: Number(r.quantity),
    reference: r.reference,
    project: r.project,
    warehouse: r.warehouse?.name || null,
    href: buildHrefFromReference(r.reference),
    ...(policy.canViewUnitCosts ? { unitCost: Number(r.unitCost || 0), total: Number(r.total || 0) } : {}),
  }));

  // Activity: summarized from ledger entries (chronological).
  const activity: ItemActivityRow[] = policy.tabs.activity
    ? ledgerRows.slice(0, 50).map((r) => ({
        at: iso(r.date),
        type: r.type,
        quantity: Number(r.quantity),
        label: r.reference ? `${r.type} • ${r.reference}` : r.type,
        href: buildHrefFromReference(r.reference),
        ...(policy.canViewUnitCosts ? { amount: Number(r.total || 0) } : {}),
      }))
    : [];

  // On-hand by warehouse: group inventory ledger quantities and values.
  // Note: legacy rows may have null warehouseId. Keep them grouped as "Unknown".
  const group = policy.canViewUnitCosts
    ? await prisma.inventoryLedger.groupBy({
        by: ["warehouseId"],
        where: { itemId: item.id },
        _sum: { quantity: true, total: true },
      })
    : await prisma.inventoryLedger.groupBy({
        by: ["warehouseId"],
        where: { itemId: item.id },
        _sum: { quantity: true },
      });
  const warehouseIds = group.map((g) => g.warehouseId).filter((id): id is string => Boolean(id));
  const warehouses = warehouseIds.length
    ? await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } }, select: { id: true, name: true } })
    : [];
  const whName = new Map<string, string>(warehouses.map((w) => [w.id, w.name]));

  const onHand: ItemOnHandRow[] = group.map((g) => ({
    warehouseId: g.warehouseId,
    warehouseName: g.warehouseId ? whName.get(g.warehouseId) || "Unknown" : "Unknown",
    quantity: Number(g._sum.quantity || 0),
    ...(policy.canViewUnitCosts && "total" in g._sum ? { value: Number(g._sum.total || 0) } : {}),
  }));

  // Documents: derived from references (best-effort) + link to list filters.
  const documents: ItemDocumentRow[] = [];
  if (policy.tabs.documents) {
    const seen = new Set<string>();
    for (const e of ledgerEntries) {
      if (!e.reference) continue;
      if (seen.has(e.reference)) continue;
      const href = buildHrefFromReference(e.reference);
      if (!href) continue;
      seen.add(e.reference);
      documents.push({ type: e.type, number: e.reference, date: e.date, href });
    }
  }

  const header: ItemDetailHeader = {
    id: item.id,
    name: item.name,
    sku: item.sku,
    category: item.category,
    unit: item.unit,
    status: "ACTIVE",
    reorderLevel: item.reorderQty !== null ? Number(item.reorderQty) : null,
    minStock: item.minStock !== null ? Number(item.minStock) : null,
    availableQty: Number(item.availableQty || 0),
  };

  const auditRows = await prisma.auditLog.findMany({
    where: {
      entity: "InventoryItem",
      entityId: item.id,
      action: { in: ["ITEM_NOTE_ADD", "ITEM_ATTACHMENT_ADD"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { action: true, newValue: true, createdAt: true },
  });

  const notesHistory: ItemNotesHistoryRow[] = auditRows.map((r) => {
    const base: ItemNotesHistoryRow = {
      at: iso(r.createdAt),
      action: r.action as ItemNotesHistoryRow["action"],
      note: null,
      attachment: null,
    };
    if (!r.newValue) return base;
    try {
      const parsed = JSON.parse(r.newValue) as unknown;
      if (base.action === "ITEM_NOTE_ADD" && parsed && typeof parsed === "object") {
        const note = (parsed as { note?: unknown }).note;
        if (typeof note === "string") base.note = note;
      }
      if (base.action === "ITEM_ATTACHMENT_ADD" && parsed && typeof parsed === "object") {
        const fileName = (parsed as { fileName?: unknown }).fileName;
        const url = (parsed as { url?: unknown }).url;
        if (typeof fileName === "string" && typeof url === "string") {
          base.attachment = { fileName, url };
        }
      }
    } catch {
      // Ignore invalid JSON (legacy rows); keep base event.
    }
    return base;
  });

  const data: ItemDetailData = {
    header,
    policy,
    activity,
    notesHistory,
    ledger: {
      entries: ledgerEntries,
      page,
      totalPages,
      totalCount: ledgerCount,
    },
    onHand,
    documents,
  };

  return { ok: true as const, data };
}
