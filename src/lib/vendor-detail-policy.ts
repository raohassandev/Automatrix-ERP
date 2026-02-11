import { prisma } from "@/lib/prisma";
import { getUserRoleName } from "@/lib/rbac";
import { hasPermission, RoleName } from "@/lib/permissions";

export type VendorDetailTab = "activity" | "bills" | "payments" | "aging" | "documents";

export type VendorDetailPolicy = {
  role: RoleName;
  canAccessPage: boolean;
  tabs: Record<VendorDetailTab, boolean>;
  canViewAmounts: boolean;
};

export type VendorDetailHeader = {
  id: string;
  name: string;
  status: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTermsLabel: string; // Phase 1 default: Net 30
  attachmentsCount: number;
};

export type VendorActivityRow = {
  at: string; // ISO
  type: "PO" | "GRN" | "BILL" | "PAYMENT";
  label: string;
  status?: string | null;
  amount?: number | null;
  href?: string | null;
};

export type VendorDocumentsRow = {
  type: "PO" | "GRN" | "BILL" | "PAYMENT";
  number: string;
  status: string;
  date: string;
  projectRef?: string | null;
  href: string;
};

export type VendorDetailData = {
  header: VendorDetailHeader;
  policy: VendorDetailPolicy;
  activity: VendorActivityRow[];
  bills?: Array<{
    id: string;
    billNumber: string;
    billDate: string;
    status: string;
    projectRef: string | null;
    totalAmount?: number;
  }>;
  payments?: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    status: string;
    projectRef: string | null;
    amount?: number;
    allocatedAmount?: number;
  }>;
  aging?: {
    asOf: string;
    current: number;
    overdue: number;
    buckets: Array<{ label: string; amount: number }>;
  };
  documents: VendorDocumentsRow[];
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function iso(d: Date) {
  return d.toISOString();
}

function buildPolicy(role: RoleName): VendorDetailPolicy {
  // Vendor detail is a procurement-facing view, but we allow limited read access for other roles via scoping.
  const canAccessPage =
    hasPermission(role, "procurement.view_all") ||
    hasPermission(role, "vendors.view_all") ||
    hasPermission(role, "projects.view_all") ||
    hasPermission(role, "projects.view_assigned");

  // Amounts are sensitive: only roles with explicit cost permission should see totals/amounts.
  const canViewAmounts = hasPermission(role, "inventory.view_cost");

  const isSalesOrMarketing = role === "Sales" || role === "Marketing";
  const isStoreOrTech = role === "Store Keeper" || role === "Staff";
  const isEngineer = role === "Engineering";

  const tabs: Record<VendorDetailTab, boolean> = {
    activity: canAccessPage,
    documents: canAccessPage,
    bills: canAccessPage && !isSalesOrMarketing && !isStoreOrTech && !isEngineer && hasPermission(role, "procurement.view_all"),
    payments: canAccessPage && !isSalesOrMarketing && !isStoreOrTech && !isEngineer && hasPermission(role, "procurement.view_all"),
    aging: canAccessPage && !isSalesOrMarketing && !isStoreOrTech && !isEngineer && canViewAmounts,
  };

  // Sales/Marketing: docs-only view.
  if (isSalesOrMarketing) {
    tabs.bills = false;
    tabs.payments = false;
    tabs.aging = false;
  }

  // Store/Technician/Engineer: documents + activity only.
  if (isStoreOrTech || isEngineer) {
    tabs.bills = false;
    tabs.payments = false;
    tabs.aging = false;
  }

  return { role, canAccessPage, tabs, canViewAmounts };
}

async function getAssignedProjectRefs(userId: string) {
  const rows = await prisma.projectAssignment.findMany({
    where: { userId },
    select: { project: { select: { projectId: true } } },
  });
  return Array.from(new Set(rows.map((r) => r.project.projectId).filter(Boolean)));
}

async function isVendorVisibleViaAssignedProjects(args: {
  vendorId: string;
  assignedProjectRefs: string[];
}) {
  if (args.assignedProjectRefs.length === 0) return false;

  const [po, grn, bill, payment] = await Promise.all([
    prisma.purchaseOrder.findFirst({
      where: { vendorId: args.vendorId, projectRef: { in: args.assignedProjectRefs } },
      select: { id: true },
    }),
    prisma.goodsReceipt.findFirst({
      where: {
        projectRef: { in: args.assignedProjectRefs },
        purchaseOrder: { vendorId: args.vendorId },
      },
      select: { id: true },
    }),
    prisma.vendorBill.findFirst({
      where: { vendorId: args.vendorId, projectRef: { in: args.assignedProjectRefs } },
      select: { id: true },
    }),
    prisma.vendorPayment.findFirst({
      where: { vendorId: args.vendorId, projectRef: { in: args.assignedProjectRefs } },
      select: { id: true },
    }),
  ]);

  return Boolean(po || grn || bill || payment);
}

export async function getVendorDetailForUser(args: { userId: string; vendorDbId: string }) {
  const role = await getUserRoleName(args.userId);
  const policy = buildPolicy(role);
  const isSalesOrMarketing = policy.role === "Sales" || policy.role === "Marketing";
  const isStoreOrTech = policy.role === "Store Keeper" || policy.role === "Staff";
  const isEngineer = policy.role === "Engineering";

  if (!policy.canAccessPage) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const canViewProcurementAll =
    hasPermission(role, "procurement.view_all") || hasPermission(role, "vendors.view_all");
  const assignedProjectRefs = canViewProcurementAll ? null : await getAssignedProjectRefs(args.userId);
  if (!canViewProcurementAll) {
    // Restricted roles can only access vendors if they are visible via assigned projects.
    const visible = await isVendorVisibleViaAssignedProjects({
      vendorId: args.vendorDbId,
      assignedProjectRefs: assignedProjectRefs || [],
    });
    if (!visible) {
      return { ok: false as const, status: 403 as const, error: "Forbidden" };
    }
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: args.vendorDbId },
    select: {
      id: true,
      name: true,
      status: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
    },
  });
  if (!vendor) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const attachmentsCount = await prisma.attachment.count({
    where: { type: "vendor", recordId: vendor.id },
  });

  const header: VendorDetailHeader = {
    id: vendor.id,
    name: vendor.name,
    status: vendor.status,
    contactName: vendor.contactName || null,
    phone: vendor.phone || null,
    email: vendor.email || null,
    address: vendor.address || null,
    paymentTermsLabel: "Net 30",
    attachmentsCount,
  };

  // Lists are capped/paged to avoid large payloads.
  const take = 25;

  // --- Documents (PO/GRN/Bill/Payment) ---
  const [pos, grns] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        vendorId: vendor.id,
        ...(assignedProjectRefs ? { projectRef: { in: assignedProjectRefs } } : {}),
      },
      select: { id: true, poNumber: true, orderDate: true, status: true, projectRef: true },
      orderBy: { orderDate: "desc" },
      take,
    }),
    prisma.goodsReceipt.findMany({
      where: {
        purchaseOrder: { vendorId: vendor.id },
        ...(assignedProjectRefs ? { projectRef: { in: assignedProjectRefs } } : {}),
      },
      select: {
        id: true,
        grnNumber: true,
        receivedDate: true,
        status: true,
        projectRef: true,
      },
      orderBy: { receivedDate: "desc" },
      take,
    }),
  ]);

  const documents: VendorDocumentsRow[] = [
    ...pos.map((po) => ({
      type: "PO" as const,
      number: po.poNumber,
      status: po.status,
      date: fmtDate(po.orderDate),
      projectRef: po.projectRef || null,
      href: `/procurement/purchase-orders?search=${encodeURIComponent(po.poNumber)}`,
    })),
    ...grns.map((grn) => ({
      type: "GRN" as const,
      number: grn.grnNumber,
      status: grn.status,
      date: fmtDate(grn.receivedDate),
      projectRef: grn.projectRef || null,
      href: `/procurement/grn?search=${encodeURIComponent(grn.grnNumber)}`,
    })),
  ];

  // Bills/Payments only if allowed for the role.
  let bills: VendorDetailData["bills"];
  let payments: VendorDetailData["payments"];
  let aging: VendorDetailData["aging"];

  if (policy.tabs.bills || policy.tabs.payments || policy.tabs.aging || policy.tabs.activity) {
    const billSelect: Record<string, unknown> = {
      id: true,
      billNumber: true,
      billDate: true,
      status: true,
      projectRef: true,
    };
    if (policy.canViewAmounts) billSelect.totalAmount = true;

    const paymentSelect: Record<string, unknown> = {
      id: true,
      paymentNumber: true,
      paymentDate: true,
      status: true,
      projectRef: true,
    };
    if (policy.canViewAmounts) {
      paymentSelect.amount = true;
      paymentSelect.allocations = { select: { amount: true, vendorBill: { select: { id: true } }, vendorPayment: { select: { status: true } } } };
    }

    type BillRow = {
      id: string;
      billNumber: string;
      billDate: Date;
      status: string;
      projectRef: string | null;
      totalAmount?: unknown;
    };
    type PaymentRow = {
      id: string;
      paymentNumber: string;
      paymentDate: Date;
      status: string;
      projectRef: string | null;
      amount?: unknown;
      allocations?: Array<{ amount: unknown; vendorPayment: { status: string } }>;
    };

    const [billRows, paymentRows] = await Promise.all([
      prisma.vendorBill.findMany({
        where: {
          vendorId: vendor.id,
          ...(assignedProjectRefs ? { projectRef: { in: assignedProjectRefs } } : {}),
        },
        select: billSelect as never,
        orderBy: { billDate: "desc" },
        take,
      }) as unknown as BillRow[],
      prisma.vendorPayment.findMany({
        where: {
          vendorId: vendor.id,
          ...(assignedProjectRefs ? { projectRef: { in: assignedProjectRefs } } : {}),
        },
        select: paymentSelect as never,
        orderBy: { paymentDate: "desc" },
        take,
      }) as unknown as PaymentRow[],
    ]);

    if (policy.tabs.bills) {
      bills = billRows.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        billDate: fmtDate(b.billDate),
        status: b.status,
        projectRef: b.projectRef,
        ...(policy.canViewAmounts ? { totalAmount: Number(b.totalAmount || 0) } : {}),
      }));
    }

    if (policy.tabs.payments) {
      payments = paymentRows.map((p) => {
        const allocated =
          policy.canViewAmounts && Array.isArray(p.allocations)
            ? p.allocations
                .filter((a) => a.vendorPayment.status === "POSTED")
                .reduce((sum, a) => sum + Number(a.amount || 0), 0)
            : undefined;
        return {
          id: p.id,
          paymentNumber: p.paymentNumber,
          paymentDate: fmtDate(p.paymentDate),
          status: p.status,
          projectRef: p.projectRef,
          ...(policy.canViewAmounts ? { amount: Number(p.amount || 0), allocatedAmount: allocated || 0 } : {}),
        };
      });
    }

    // AP aging (truth: posted bills minus posted allocations) — only when amounts allowed.
    if (policy.tabs.aging && policy.canViewAmounts) {
      // Use posted bills only to keep the numbers truthful.
      const postedBills = await prisma.vendorBill.findMany({
        where: { vendorId: vendor.id, status: "POSTED" },
        select: {
          id: true,
          billDate: true,
          dueDate: true,
          totalAmount: true,
          allocations: { select: { amount: true, vendorPayment: { select: { status: true } } } },
        },
        orderBy: { billDate: "desc" },
        take: 200,
      });
      const today = new Date();
      const buckets = [
        { label: "1-30", fromDays: 1, toDays: 30, amount: 0 },
        { label: "31-60", fromDays: 31, toDays: 60, amount: 0 },
        { label: "61-90", fromDays: 61, toDays: 90, amount: 0 },
        { label: "90+", fromDays: 91, toDays: 10_000, amount: 0 },
      ];
      let current = 0;
      let overdue = 0;

      for (const bill of postedBills) {
        const paid = bill.allocations
          .filter((a) => a.vendorPayment.status === "POSTED")
          .reduce((sum, a) => sum + Number(a.amount), 0);
        const outstanding = Math.max(0, Number(bill.totalAmount) - paid);
        if (outstanding <= 0) continue;

        const due = bill.dueDate || new Date(bill.billDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const daysLate = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
        if (daysLate <= 0) {
          current += outstanding;
        } else {
          overdue += outstanding;
          const bucket = buckets.find((b) => daysLate >= b.fromDays && daysLate <= b.toDays);
          if (bucket) bucket.amount += outstanding;
        }
      }

      aging = {
        asOf: fmtDate(today),
        current,
        overdue,
        buckets: buckets.map((b) => ({ label: b.label, amount: b.amount })),
      };
    }

    // Activity feed: chronological, link to list pages. Amounts included only if allowed.
    const activity: VendorActivityRow[] = [];
    for (const po of pos) {
      activity.push({
        at: iso(po.orderDate),
        type: "PO",
        label: `PO ${po.poNumber}`,
        status: po.status,
        href: `/procurement/purchase-orders?search=${encodeURIComponent(po.poNumber)}`,
      });
    }
    for (const grn of grns) {
      activity.push({
        at: iso(grn.receivedDate),
        type: "GRN",
        label: `GRN ${grn.grnNumber}`,
        status: grn.status,
        href: `/procurement/grn?search=${encodeURIComponent(grn.grnNumber)}`,
      });
    }
    const allowFinancialDocsInActivityAndDocuments = !isSalesOrMarketing && !isStoreOrTech && !isEngineer;
    if (allowFinancialDocsInActivityAndDocuments) {
      for (const b of billRows) {
        activity.push({
          at: iso(b.billDate),
          type: "BILL",
          label: `Bill ${b.billNumber}`,
          status: b.status,
          href: `/procurement/vendor-bills?search=${encodeURIComponent(b.billNumber)}`,
          ...(policy.canViewAmounts ? { amount: Number(b.totalAmount || 0) } : {}),
        });
        documents.push({
          type: "BILL",
          number: b.billNumber,
          status: b.status,
          date: fmtDate(b.billDate),
          projectRef: b.projectRef,
          href: `/procurement/vendor-bills?search=${encodeURIComponent(b.billNumber)}`,
        });
      }
      for (const p of paymentRows) {
        activity.push({
          at: iso(p.paymentDate),
          type: "PAYMENT",
          label: `Payment ${p.paymentNumber}`,
          status: p.status,
          href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
          ...(policy.canViewAmounts ? { amount: Number(p.amount || 0) } : {}),
        });
        documents.push({
          type: "PAYMENT",
          number: p.paymentNumber,
          status: p.status,
          date: fmtDate(p.paymentDate),
          projectRef: p.projectRef,
          href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
        });
      }
    }

    activity.sort((a, b) => b.at.localeCompare(a.at));
    documents.sort((a, b) => b.date.localeCompare(a.date));

    const data: VendorDetailData = {
      header,
      policy,
      activity,
      // Sales/Marketing/Store/Engineering: Phase 1 vendor view excludes bills/payments entirely.
      documents: documents
        .filter((d) => (allowFinancialDocsInActivityAndDocuments ? true : d.type === "PO" || d.type === "GRN"))
        .slice(0, 100),
      ...(bills ? { bills } : {}),
      ...(payments ? { payments } : {}),
      ...(aging ? { aging } : {}),
    };

    return { ok: true as const, data };
  }

  // Minimal response (docs + header only)
  const activity: VendorActivityRow[] = [];
  for (const po of pos) {
    activity.push({
      at: iso(po.orderDate),
      type: "PO",
      label: `PO ${po.poNumber}`,
      status: po.status,
      href: `/procurement/purchase-orders?search=${encodeURIComponent(po.poNumber)}`,
    });
  }
  for (const grn of grns) {
    activity.push({
      at: iso(grn.receivedDate),
      type: "GRN",
      label: `GRN ${grn.grnNumber}`,
      status: grn.status,
      href: `/procurement/grn?search=${encodeURIComponent(grn.grnNumber)}`,
    });
  }
  activity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    ok: true as const,
    data: { header, policy, activity, documents: documents.slice(0, 100) },
  };
}
