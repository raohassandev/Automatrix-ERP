import { prisma } from "@/lib/prisma";
import { getUserRoleName } from "@/lib/rbac";
import { hasPermission, RoleName } from "@/lib/permissions";
import { buildProjectAliases, computeProjectFinancialSnapshot } from "@/lib/projects";

export type ProjectDetailTab = "activity" | "costs" | "inventory" | "people" | "execution" | "documents";

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
  type: "PO" | "GRN" | "BILL" | "PAYMENT" | "LEDGER" | "EXPENSE" | "INCOME";
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

export type ProjectNotesHistoryRow = {
  at: string; // ISO
  action: "PROJECT_NOTE_ADD" | "PROJECT_ATTACHMENT_ADD";
  note?: string | null;
  attachment?: { fileName: string; url: string } | null;
};

export type ProjectDetailData = {
  header: ProjectDetailHeader;
  policy: ProjectDetailPolicy;
  activity: ProjectActivityRow[];
  notesHistory: ProjectNotesHistoryRow[];
  costs?: {
    contractValue: number;
    invoicedAmount: number;
    receivedAmount: number;
    invoicedPendingRecovery: number;
    costToDate: number;
    pendingRecovery: number;
    grossMargin: number;
    marginPercent: number;
    apBilledTotal: number;
    apPaidTotal: number;
    apOutstanding: number;
    incentivesApproved: number;
    otherNonStockExpensesApproved: number;
    nonStockExpensesApproved: number;
    approvedIncomeReceived: number;
    pendingIncomeSubmitted: number;
    pendingExpenseSubmitted: number;
    totalProjectCosts: number;
    projectProfit: number;
    risk: {
      overdueRecoveryAmount: number;
      overdueInvoiceCount: number;
      negativeMargin: boolean;
      highUnpaidVendorExposure: boolean;
      alerts: string[];
    };
  };
  inventory?: {
    source: "LEDGER" | "MIXED" | "EXPENSE_FALLBACK";
    note?: string;
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
  execution?: {
    tasks: Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      dueDate: string | null;
      progress: number;
      assignedTo: { id: string; name: string; email: string } | null;
      createdAt: string;
      updatedAt: string;
    }>;
    summary: {
      total: number;
      todo: number;
      inProgress: number;
      blocked: number;
      done: number;
      overdueOpen: number;
    };
  };
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
    execution: canAccessPage && (hasPermission(role, "projects.view_all") || hasPermission(role, "projects.view_assigned")),
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
    tabs.execution = false;
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
  const projectAliases = buildProjectAliases(project);

  const isSalesOrMarketing = policy.role === "Sales" || policy.role === "Marketing";
  const includeLedgerInResponse = policy.tabs.inventory;
  const includeExpensesInResponse = (policy.tabs.activity || policy.tabs.costs) && !isSalesOrMarketing;

  const billSelect: Record<string, unknown> = {
    id: true,
    billNumber: true,
    billDate: true,
    status: true,
  };
  if (policy.canViewFinancialTotals || policy.tabs.costs) {
    billSelect.totalAmount = true;
  }

  const paymentSelect: Record<string, unknown> = {
    id: true,
    paymentNumber: true,
    paymentDate: true,
    status: true,
  };
  if (policy.canViewFinancialTotals) {
    paymentSelect.amount = true;
  }

  const ledgerSelect: Record<string, unknown> = {
    id: true,
    date: true,
    quantity: true,
    reference: true,
    sourceType: true,
    sourceId: true,
    item: { select: { name: true, unit: true } },
  };
  if (policy.canViewUnitCosts) {
    ledgerSelect.unitCost = true;
    ledgerSelect.total = true;
  }

  const expenseSelect: Record<string, unknown> = {
    id: true,
    date: true,
    description: true,
    category: true,
    status: true,
  };
  if (policy.canViewFinancialTotals || policy.tabs.costs) {
    expenseSelect.amount = true;
    expenseSelect.approvedAmount = true;
  }
  if (policy.tabs.inventory) {
    expenseSelect.amount = true;
    expenseSelect.inventoryLedgerId = true;
  }

  type PoRow = { id: string; poNumber: string; orderDate: Date; status: string };
  type GrnRow = { id: string; grnNumber: string; receivedDate: Date; status: string };
  type BillRow = { id: string; billNumber: string; billDate: Date; status: string; totalAmount?: unknown };
  type PaymentRow = { id: string; paymentNumber: string; paymentDate: Date; status: string; amount?: unknown };
  type LedgerRow = {
    id: string;
    date: Date;
    quantity: unknown;
    reference: string | null;
    sourceType: string | null;
    sourceId: string | null;
    unitCost?: unknown;
    total?: unknown;
    item: { name: string; unit: string } | null;
  };
  type ExpenseRow = {
    id: string;
    date: Date;
    description: string;
    category: string;
    status: string;
    amount?: unknown;
    approvedAmount?: unknown;
    inventoryLedgerId?: string | null;
  };
  type IncomeRow = {
    id: string;
    date: Date;
    source: string;
    category: string;
    status: string;
    amount?: unknown;
  };
  type ProjectTaskRow = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    progress: number;
    createdAt: Date;
    updatedAt: Date;
    assignedTo: { id: string; name: string | null; email: string } | null;
  };

  const [pos, grns, bills, payments, ledger, expensesAll, incomesAll, tasks] = (await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { projectRef: { in: projectAliases } },
      select: { id: true, poNumber: true, orderDate: true, status: true },
      orderBy: { orderDate: "desc" },
      take: 50,
    }),
    prisma.goodsReceipt.findMany({
      where: {
        OR: [{ projectRef: { in: projectAliases } }, { purchaseOrder: { projectRef: { in: projectAliases } } }],
      },
      select: { id: true, grnNumber: true, receivedDate: true, status: true },
      orderBy: { receivedDate: "desc" },
      take: 50,
    }),
    prisma.vendorBill.findMany({
      where: { projectRef: { in: projectAliases } },
      select: billSelect as never,
      orderBy: { billDate: "desc" },
      take: 50,
    }),
    prisma.vendorPayment.findMany({
      where: { projectRef: { in: projectAliases } },
      select: paymentSelect as never,
      orderBy: { paymentDate: "desc" },
      take: 50,
    }),
    includeLedgerInResponse
      ? prisma.inventoryLedger.findMany({
          where: { project: { in: projectAliases } },
          select: ledgerSelect as never,
          orderBy: { date: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    includeExpensesInResponse
      ? prisma.expense.findMany({
          where: {
            project: { in: projectAliases },
            status: { notIn: ["REJECTED"] },
          },
          select: expenseSelect as never,
          orderBy: { date: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    includeExpensesInResponse
      ? prisma.income.findMany({
          where: {
            project: { in: projectAliases },
            status: { not: "REJECTED" },
          },
          select: {
            id: true,
            date: true,
            source: true,
            category: true,
            status: true,
            amount: policy.canViewFinancialTotals || policy.tabs.costs,
          },
          orderBy: { date: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    policy.tabs.execution
      ? (prisma as unknown as {
          projectTask: { findMany: (args: unknown) => Promise<unknown> };
        }).projectTask.findMany({
          where: { projectId: project.id },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
          take: 300,
        })
      : Promise.resolve([]),
  ])) as unknown as [
    PoRow[],
    GrnRow[],
    BillRow[],
    PaymentRow[],
    LedgerRow[],
    ExpenseRow[],
    IncomeRow[],
    ProjectTaskRow[],
  ];
  const taskRows = tasks as unknown as ProjectTaskRow[];

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
      amount: policy.canViewFinancialTotals ? Number((b as { totalAmount?: unknown }).totalAmount) : null,
      href: `/procurement/vendor-bills?search=${encodeURIComponent(b.billNumber)}`,
    });
  }
  for (const p of payments) {
    activity.push({
      at: formatIso(p.paymentDate),
      type: "PAYMENT",
      label: `Payment ${p.paymentNumber}`,
      status: p.status,
      amount: policy.canViewFinancialTotals ? Number((p as { amount?: unknown }).amount) : null,
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
  for (const e of expensesAll) {
    activity.push({
      at: formatIso(e.date),
      type: "EXPENSE",
      label: `${e.category}: ${e.description}`,
      status: e.status,
      amount: policy.canViewFinancialTotals
        ? (() => {
            const v = e as { amount?: unknown; approvedAmount?: unknown };
            const used =
              e.status === "PARTIALLY_APPROVED" && v.approvedAmount != null
                ? Number(v.approvedAmount)
                : Number(v.amount);
            return Number.isFinite(used) ? used : 0;
          })()
        : null,
      href: `/expenses?search=${encodeURIComponent(e.description.slice(0, 20))}`,
    });
  }
  for (const i of incomesAll) {
    activity.push({
      at: formatIso(i.date),
      type: "INCOME",
      label: `Income: ${i.source} (${i.category})`,
      status: i.status,
      amount: policy.canViewFinancialTotals ? Number(i.amount) : null,
      href: `/income?search=${encodeURIComponent(i.source.slice(0, 20))}`,
    });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  // Costs (Phase 1 truth): AP from posted bills minus posted allocations; plus non-stock expenses.
  let costs: ProjectDetailData["costs"] | undefined = undefined;
  if (policy.tabs.costs) {
    const snapshot = await computeProjectFinancialSnapshot(project);
    const highUnpaidVendorExposure = snapshot.highUnpaidVendorExposure;
    const negativeMargin = snapshot.negativeMargin;
    const alerts: string[] = [];
    if (negativeMargin) alerts.push("Negative project margin detected.");
    if (snapshot.overdueRecoveryAmount > 0)
      alerts.push(
        `${snapshot.overdueInvoiceCount} overdue invoice(s): ${snapshot.overdueRecoveryAmount.toLocaleString()} still unrecovered.`,
      );
    if (highUnpaidVendorExposure)
      alerts.push("High unpaid vendor exposure versus current recovered income.");

    costs = {
      contractValue: snapshot.contractValue,
      invoicedAmount: snapshot.invoicedAmount,
      receivedAmount: snapshot.receivedAmount,
      invoicedPendingRecovery: snapshot.invoicedPendingRecovery,
      costToDate: snapshot.costToDate,
      pendingRecovery: snapshot.pendingRecovery,
      grossMargin: snapshot.grossMargin,
      marginPercent: snapshot.marginPercent,
      apBilledTotal: snapshot.apBilledTotal,
      apPaidTotal: snapshot.apPaidTotal,
      apOutstanding: snapshot.apOutstanding,
      incentivesApproved: snapshot.incentivesApproved,
      otherNonStockExpensesApproved: snapshot.otherNonStockExpensesApproved,
      nonStockExpensesApproved: snapshot.nonStockExpensesApproved,
      approvedIncomeReceived: snapshot.approvedIncomeReceived,
      pendingIncomeSubmitted: snapshot.pendingIncomeSubmitted,
      pendingExpenseSubmitted: snapshot.pendingExpenseSubmitted,
      totalProjectCosts: snapshot.totalProjectCosts,
      projectProfit: snapshot.projectProfit,
      risk: {
        overdueRecoveryAmount: snapshot.overdueRecoveryAmount,
        overdueInvoiceCount: snapshot.overdueInvoiceCount,
        negativeMargin,
        highUnpaidVendorExposure,
        alerts,
      },
    };
  }

  // Inventory movements
  let inventory: ProjectDetailData["inventory"] | undefined = undefined;
  if (policy.tabs.inventory) {
    const ledgerEntries = ledger.map((l) => ({
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
    const materialExpenseFallback = expensesAll
      .filter((e) => {
        const status = String(e.status || "").toUpperCase();
        if (!["APPROVED", "PARTIALLY_APPROVED", "PAID"].includes(status)) return false;
        if (e.inventoryLedgerId) return false;
        const category = String(e.category || "").toLowerCase();
        return category.includes("material") || category.includes("stock") || category.includes("inventory");
      })
      .map((e) => {
        const useAmount =
          e.status === "PARTIALLY_APPROVED" && e.approvedAmount != null
            ? Number(e.approvedAmount)
            : Number(e.amount ?? e.approvedAmount ?? 0);
        return {
          id: `expense-${e.id}`,
          date: fmtDate(e.date),
          itemName: e.description || e.category || "Material expense",
          unit: "entry",
          quantity: -1,
          unitCost: policy.canViewUnitCosts ? (Number.isFinite(useAmount) ? useAmount : 0) : null,
          total: policy.canViewUnitCosts ? (Number.isFinite(useAmount) ? useAmount : 0) : null,
          reference: "Expense fallback",
          href: `/expenses?search=${encodeURIComponent((e.description || e.category || "").slice(0, 24))}`,
        };
      });
    const entries = [...ledgerEntries, ...materialExpenseFallback];
    const source: "LEDGER" | "MIXED" | "EXPENSE_FALLBACK" =
      ledgerEntries.length > 0 && materialExpenseFallback.length > 0
        ? "MIXED"
        : ledgerEntries.length > 0
          ? "LEDGER"
          : "EXPENSE_FALLBACK";
    const totals = policy.canViewUnitCosts
      ? {
          quantity: entries.reduce((sum, e) => sum + Number(e.quantity), 0),
          value: entries.reduce((sum, e) => sum + Number(e.total || 0), 0),
        }
      : undefined;
    const note =
      source === "EXPENSE_FALLBACK"
        ? "No stock ledger movement found. Showing approved material expenses as fallback usage entries."
        : source === "MIXED"
          ? "Some material usage is from stock ledger, and some appears as approved material expenses without stock issuance."
          : undefined;
    inventory = { source, note, entries, totals };
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

  let execution: ProjectDetailData["execution"] | undefined = undefined;
  if (policy.tabs.execution) {
    const now = new Date();
    const openStatuses = new Set(["TODO", "IN_PROGRESS", "BLOCKED"]);
    const summary = taskRows.reduce(
      (acc, task) => {
        acc.total += 1;
        const status = String(task.status || "").toUpperCase();
        if (status === "TODO") acc.todo += 1;
        if (status === "IN_PROGRESS") acc.inProgress += 1;
        if (status === "BLOCKED") acc.blocked += 1;
        if (status === "DONE") acc.done += 1;
        if (task.dueDate && openStatuses.has(status) && task.dueDate < now) {
          acc.overdueOpen += 1;
        }
        return acc;
      },
      { total: 0, todo: 0, inProgress: 0, blocked: 0, done: 0, overdueOpen: 0 },
    );

    execution = {
      tasks: taskRows.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? fmtDate(task.dueDate) : null,
        progress: Number(task.progress || 0),
        assignedTo: task.assignedTo
          ? {
              id: task.assignedTo.id,
              name: task.assignedTo.name || task.assignedTo.email,
              email: task.assignedTo.email,
            }
          : null,
        createdAt: formatIso(task.createdAt),
        updatedAt: formatIso(task.updatedAt),
      })),
      summary,
    };
  }

  const auditRows = await prisma.auditLog.findMany({
    where: {
      entity: "Project",
      entityId: project.id,
      action: { in: ["PROJECT_NOTE_ADD", "PROJECT_ATTACHMENT_ADD"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { action: true, newValue: true, createdAt: true },
  });

  const notesHistory: ProjectNotesHistoryRow[] = auditRows.map((r) => {
    const base: ProjectNotesHistoryRow = {
      at: formatIso(r.createdAt),
      action: r.action as ProjectNotesHistoryRow["action"],
      note: null,
      attachment: null,
    };
    if (!r.newValue) return base;
    try {
      const parsed = JSON.parse(r.newValue) as unknown;
      if (base.action === "PROJECT_NOTE_ADD" && parsed && typeof parsed === "object") {
        const note = (parsed as { note?: unknown }).note;
        if (typeof note === "string") base.note = note;
      }
      if (base.action === "PROJECT_ATTACHMENT_ADD" && parsed && typeof parsed === "object") {
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

  const data: ProjectDetailData = {
    header,
    policy,
    activity,
    notesHistory,
    costs,
    inventory,
    people,
    execution,
    documents: policy.tabs.documents ? documents : undefined,
  };

  return { ok: true as const, status: 200 as const, data };
}
