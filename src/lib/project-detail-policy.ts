import { prisma } from "@/lib/prisma";
import { getUserRoleName } from "@/lib/rbac";
import { hasPermission, RoleName } from "@/lib/permissions";

export type ProjectDetailTab = "activity" | "costs" | "inventory" | "people" | "documents";

export type ProjectDetailPolicy = {
  role: RoleName;
  canAccessPage: boolean;
  tabs: Record<ProjectDetailTab, boolean>;
  // Field-level masking
  canViewUnitCosts: boolean;
  canViewFinancialTotals: boolean;
};

export type ProjectDetailHeader = {
  id: string;
  projectId: string;
  name: string;
  client: { id: string; name: string };
  status: string;
  startDate: string;
  endDate: string | null;
  manager: { name: string; email: string } | null;
};

export type ProjectActivityRow = {
  at: string; // ISO
  type: "PO" | "GRN" | "BILL" | "PAYMENT" | "LEDGER" | "EXPENSE";
  label: string;
  status?: string | null;
  amount?: number | null;
  quantity?: number | null;
  href?: string | null;
};

export type ProjectDocumentsRow = {
  type: "PO" | "GRN" | "BILL" | "PAYMENT";
  number: string;
  status: string;
  date: string;
  href: string;
};

export type ProjectDetailData = {
  header: ProjectDetailHeader;
  policy: ProjectDetailPolicy;
  activity: ProjectActivityRow[];
  costs?: {
    apBilledTotal: number;
    apPaidTotal: number;
    apOutstanding: number;
    nonStockExpensesApproved: number;
  };
  inventory?: {
    entries: Array<{
      id: string;
      date: string;
      itemName: string;
      unit: string;
      quantity: number;
      unitCost?: number | null;
      total?: number | null;
      reference?: string | null;
      href?: string | null;
    }>;
    totals?: { quantity: number; value: number };
  };
  people?: Array<{ id: string; name: string; email: string; role: string }>;
  documents?: ProjectDocumentsRow[];
};

function formatIso(d: Date) {
  return d.toISOString();
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildPolicy(role: RoleName): ProjectDetailPolicy {
  const canAccessPage =
    hasPermission(role, "projects.view_all") || hasPermission(role, "projects.view_assigned");

  const canViewUnitCosts = hasPermission(role, "inventory.view_cost");
  const canViewFinancialTotals =
    hasPermission(role, "projects.view_financials") || hasPermission(role, "dashboard.view_all_metrics");

  const isSalesOrMarketing = role === "Sales" || role === "Marketing";
  const isStore = role === "Store Keeper";
  const isTechnician = role === "Staff";
  const isEngineer = role === "Engineering";

  const tabs: Record<ProjectDetailTab, boolean> = {
    activity: canAccessPage,
    costs: canAccessPage && canViewFinancialTotals,
    // Sales/Marketing: docs-only view (no inventory tab in Phase 1)
    inventory: canAccessPage && !isSalesOrMarketing && !isStore && !isTechnician && hasPermission(role, "inventory.view"),
    // Store/Technician: no financial tabs; inventory movements allowed
    people: canAccessPage && (isEngineer || hasPermission(role, "employees.view_all") || hasPermission(role, "projects.assign")),
    documents: canAccessPage,
  };

  // Store/Technician can view inventory quantities/movements, but not costs.
  if (isStore || isTechnician) {
    tabs.inventory = canAccessPage && hasPermission(role, "inventory.view");
    tabs.costs = false;
  }

  // Sales/Marketing: header + documents only.
  if (isSalesOrMarketing) {
    tabs.activity = true;
    tabs.people = false;
    tabs.inventory = false;
    tabs.costs = false;
  }

  return {
    role,
    canAccessPage,
    tabs,
    canViewUnitCosts,
    canViewFinancialTotals,
  };
}

export async function getProjectDetailForUser(args: { userId: string; projectDbId: string }) {
  const role = await getUserRoleName(args.userId);
  const policy = buildPolicy(role);

  if (!policy.canAccessPage) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const canViewAll = hasPermission(role, "projects.view_all");
  const canViewAssigned = hasPermission(role, "projects.view_assigned");
  if (!canViewAll && canViewAssigned) {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId: args.projectDbId, userId: args.userId },
      select: { id: true },
    });
    if (!assigned) {
      return { ok: false as const, status: 403 as const, error: "Forbidden" };
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: args.projectDbId },
    include: {
      client: true,
      assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!project) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const managerAssignment = project.assignments.find((a) =>
    String(a.role || "").toUpperCase().includes("MANAGER"),
  );
  const manager = managerAssignment?.user?.email
    ? { name: managerAssignment.user.name || managerAssignment.user.email, email: managerAssignment.user.email }
    : null;

  const header: ProjectDetailHeader = {
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    client: { id: project.client.id, name: project.client.name },
    status: project.status,
    startDate: fmtDate(project.startDate),
    endDate: project.endDate ? fmtDate(project.endDate) : null,
    manager,
  };

  // --- Data sources (Phase 1 single spine) ---
  const projectRef = project.projectId;

  const [pos, grns, bills, payments, ledger, expensesApproved] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { projectRef },
      select: { id: true, poNumber: true, orderDate: true, status: true },
      orderBy: { orderDate: "desc" },
      take: 50,
    }),
    prisma.goodsReceipt.findMany({
      where: { OR: [{ projectRef }, { purchaseOrder: { projectRef } }] },
      select: { id: true, grnNumber: true, receivedDate: true, status: true },
      orderBy: { receivedDate: "desc" },
      take: 50,
    }),
    prisma.vendorBill.findMany({
      where: { projectRef },
      select: { id: true, billNumber: true, billDate: true, status: true, totalAmount: true },
      orderBy: { billDate: "desc" },
      take: 50,
    }),
    prisma.vendorPayment.findMany({
      where: { projectRef },
      select: { id: true, paymentNumber: true, paymentDate: true, status: true, amount: true },
      orderBy: { paymentDate: "desc" },
      take: 50,
    }),
    prisma.inventoryLedger.findMany({
      where: { project: projectRef },
      select: {
        id: true,
        date: true,
        quantity: true,
        unitCost: true,
        total: true,
        reference: true,
        sourceType: true,
        sourceId: true,
        item: { select: { name: true, unit: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.expense.findMany({
      where: {
        project: projectRef,
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
      },
      select: { id: true, date: true, description: true, category: true, amount: true, approvedAmount: true, status: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  const documents: ProjectDocumentsRow[] = [
    ...pos.map((po) => ({
      type: "PO" as const,
      number: po.poNumber,
      status: po.status,
      date: fmtDate(po.orderDate),
      href: `/procurement/purchase-orders?search=${encodeURIComponent(po.poNumber)}`,
    })),
    ...grns.map((g) => ({
      type: "GRN" as const,
      number: g.grnNumber,
      status: g.status,
      date: fmtDate(g.receivedDate),
      href: `/procurement/grn?search=${encodeURIComponent(g.grnNumber)}`,
    })),
    ...bills.map((b) => ({
      type: "BILL" as const,
      number: b.billNumber,
      status: b.status,
      date: fmtDate(b.billDate),
      href: `/procurement/vendor-bills?search=${encodeURIComponent(b.billNumber)}`,
    })),
    ...payments.map((p) => ({
      type: "PAYMENT" as const,
      number: p.paymentNumber,
      status: p.status,
      date: fmtDate(p.paymentDate),
      href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  // Activity: merge + sort chronologically (desc)
  const activity: ProjectActivityRow[] = [];
  for (const po of pos) {
    activity.push({
      at: formatIso(po.orderDate),
      type: "PO",
      label: `PO ${po.poNumber}`,
      status: po.status,
      href: `/procurement/purchase-orders?search=${encodeURIComponent(po.poNumber)}`,
    });
  }
  for (const g of grns) {
    activity.push({
      at: formatIso(g.receivedDate),
      type: "GRN",
      label: `GRN ${g.grnNumber}`,
      status: g.status,
      href: `/procurement/grn?search=${encodeURIComponent(g.grnNumber)}`,
    });
  }
  for (const b of bills) {
    activity.push({
      at: formatIso(b.billDate),
      type: "BILL",
      label: `Bill ${b.billNumber}`,
      status: b.status,
      amount: policy.canViewFinancialTotals ? Number(b.totalAmount) : null,
      href: `/procurement/vendor-bills?search=${encodeURIComponent(b.billNumber)}`,
    });
  }
  for (const p of payments) {
    activity.push({
      at: formatIso(p.paymentDate),
      type: "PAYMENT",
      label: `Payment ${p.paymentNumber}`,
      status: p.status,
      amount: policy.canViewFinancialTotals ? Number(p.amount) : null,
      href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
    });
  }
  for (const l of ledger) {
    activity.push({
      at: formatIso(l.date),
      type: "LEDGER",
      label: `Stock ${Number(l.quantity) >= 0 ? "IN" : "OUT"}: ${l.item?.name || "Item"}`,
      quantity: Number(l.quantity),
      amount: policy.canViewUnitCosts ? Number(l.total) : null,
      href: l.sourceType === "GRN" && l.sourceId ? `/procurement/grn?search=${encodeURIComponent(l.reference || "")}` : null,
    });
  }
  for (const e of expensesApproved) {
    const used =
      e.status === "PARTIALLY_APPROVED" && e.approvedAmount
        ? Number(e.approvedAmount)
        : Number(e.amount);
    activity.push({
      at: formatIso(e.date),
      type: "EXPENSE",
      label: `${e.category}: ${e.description}`,
      status: e.status,
      amount: policy.canViewFinancialTotals ? used : null,
      href: `/expenses?search=${encodeURIComponent(e.description.slice(0, 20))}`,
    });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  // Costs (Phase 1 truth): AP from posted bills minus posted allocations; plus non-stock expenses.
  let costs: ProjectDetailData["costs"] | undefined = undefined;
  if (policy.tabs.costs) {
    const postedBills = bills.filter((b) => (b.status || "").toUpperCase() === "POSTED");
    const postedBillIds = postedBills.map((b) => b.id);
    const paidAgg =
      postedBillIds.length === 0
        ? { _sum: { amount: null } }
        : await prisma.vendorPaymentAllocation.aggregate({
            where: {
              vendorBillId: { in: postedBillIds },
              vendorPayment: { status: "POSTED" },
            },
            _sum: { amount: true },
          });
    const billedTotal = postedBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const paidTotal = Number(paidAgg._sum.amount || 0);
    const apOutstanding = Math.max(0, billedTotal - paidTotal);

    const nonStockExpensesApproved = expensesApproved.reduce((sum, e) => {
      const used =
        e.status === "PARTIALLY_APPROVED" && e.approvedAmount
          ? Number(e.approvedAmount)
          : Number(e.amount);
      return sum + used;
    }, 0);

    costs = {
      apBilledTotal: billedTotal,
      apPaidTotal: paidTotal,
      apOutstanding,
      nonStockExpensesApproved,
    };
  }

  // Inventory movements
  let inventory: ProjectDetailData["inventory"] | undefined = undefined;
  if (policy.tabs.inventory) {
    const entries = ledger.map((l) => ({
      id: l.id,
      date: fmtDate(l.date),
      itemName: l.item?.name || "Item",
      unit: l.item?.unit || "",
      quantity: Number(l.quantity),
      unitCost: policy.canViewUnitCosts ? Number(l.unitCost) : null,
      total: policy.canViewUnitCosts ? Number(l.total) : null,
      reference: l.reference || null,
      href:
        l.sourceType === "GRN" && l.reference
          ? `/procurement/grn?search=${encodeURIComponent(l.reference)}`
          : null,
    }));
    const totals = policy.canViewUnitCosts
      ? {
          quantity: entries.reduce((sum, e) => sum + Number(e.quantity), 0),
          value: entries.reduce((sum, e) => sum + Number(e.total || 0), 0),
        }
      : undefined;
    inventory = { entries, totals };
  }

  // People (project assignments)
  let people: ProjectDetailData["people"] | undefined = undefined;
  if (policy.tabs.people) {
    people = project.assignments
      .map((a) => ({
        id: a.user.id,
        name: a.user.name || a.user.email || "User",
        email: a.user.email || "",
        role: a.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const data: ProjectDetailData = {
    header,
    policy,
    activity,
    costs,
    inventory,
    people,
    documents: policy.tabs.documents ? documents : undefined,
  };

  return { ok: true as const, status: 200 as const, data };
}
