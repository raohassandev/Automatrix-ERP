import { prisma } from "@/lib/prisma";
import { getUserRoleName, requirePermission } from "@/lib/rbac";
import type { RoleName } from "@/lib/permissions";

export type CompanyAccountDetailTab = "activity" | "payments" | "summary" | "documents";

export type CompanyAccountWorkhubAction = "record_vendor_payment" | "add_note" | "add_attachment";

export type CompanyAccountWorkhubPolicy = {
  role: RoleName;
  actions: Record<CompanyAccountWorkhubAction, boolean>;
};

export type CompanyAccountDetailPolicy = {
  role: RoleName;
  canAccessPage: boolean;
  tabs: Record<CompanyAccountDetailTab, boolean>;
  workhub: CompanyAccountWorkhubPolicy;
};

export type CompanyAccountDetailHeader = {
  id: string;
  name: string;
  type: string; // CASH | BANK
  status: "ACTIVE" | "INACTIVE";
  currency: string; // Phase 1: PKR
  openingBalance: number;
  currentBalance: number; // openingBalance - posted outflows (Phase 1 outflow-only)
  attachmentsCount: number;
};

export type CompanyAccountNotesHistoryRow = {
  at: string; // ISO
  action: "COMPANY_ACCOUNT_NOTE_ADD" | "COMPANY_ACCOUNT_ATTACHMENT_ADD";
  note?: string | null;
  attachment?: { fileName: string; url: string } | null;
};

export type CompanyAccountActivityRow = {
  at: string; // ISO
  type: "PAYMENT" | "NOTE" | "ATTACHMENT";
  label: string;
  status?: string | null;
  amount?: number | null;
  href?: string | null;
};

export type CompanyAccountPaymentRow = {
  id: string;
  paymentNumber: string;
  paymentDate: string; // yyyy-mm-dd
  status: string;
  vendor: { id: string; name: string };
  projectRef: string | null;
  amount: number;
  allocatedAmount: number;
  href: string;
};

export type CompanyAccountSummaryRow = {
  month: string; // yyyy-mm
  postedOutflow: number;
  postedCount: number;
};

export type CompanyAccountDocumentRow = {
  type: "PAYMENT" | "BILL";
  number: string;
  date: string;
  status: string;
  href: string;
};

export type CompanyAccountDetailData = {
  header: CompanyAccountDetailHeader;
  policy: CompanyAccountDetailPolicy;
  notesHistory: CompanyAccountNotesHistoryRow[];
  activity: CompanyAccountActivityRow[];
  payments: {
    entries: CompanyAccountPaymentRow[];
    page: number;
    totalPages: number;
    totalCount: number;
  };
  summary: CompanyAccountSummaryRow[];
  documents: CompanyAccountDocumentRow[];
};

function iso(d: Date) {
  return d.toISOString();
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildWorkhub(role: RoleName): CompanyAccountWorkhubPolicy {
  // Phase 1: finance-only. We still keep "note/attachment" here, but access is gated at page-level.
  const canManage = role === "CEO" || role === "Owner" || role === "Admin" || role === "CFO" || role === "Finance Manager" || role === "Accountant";
  return {
    role,
    actions: {
      record_vendor_payment: canManage,
      add_note: canManage,
      add_attachment: canManage,
    },
  };
}

export async function getCompanyAccountDetailForUser(args: {
  userId: string;
  companyAccountId: string;
  paymentsPage: number;
}) {
  const role = await getUserRoleName(args.userId);

  const canAccessPage = await requirePermission(args.userId, "company_accounts.manage");
  if (!canAccessPage) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const tabs: Record<CompanyAccountDetailTab, boolean> = {
    activity: true,
    payments: true,
    summary: true,
    documents: true,
  };

  const policy: CompanyAccountDetailPolicy = {
    role,
    canAccessPage: true,
    tabs,
    workhub: buildWorkhub(role),
  };

  const account = await prisma.companyAccount.findUnique({
    where: { id: args.companyAccountId },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      openingBalance: true,
      isActive: true,
    },
  });
  if (!account) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const [attachmentsCount, postedOutflowAgg, auditRows] = await Promise.all([
    prisma.attachment.count({ where: { type: "company_account", recordId: account.id } }),
    prisma.vendorPayment.aggregate({
      where: { companyAccountId: account.id, status: "POSTED" },
      _sum: { amount: true },
    }),
    prisma.auditLog.findMany({
      where: {
        entity: "CompanyAccount",
        entityId: account.id,
        action: { in: ["COMPANY_ACCOUNT_NOTE_ADD", "COMPANY_ACCOUNT_ATTACHMENT_ADD"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, newValue: true, createdAt: true },
    }),
  ]);

  const notesHistory: CompanyAccountNotesHistoryRow[] = auditRows.map((r) => {
    const base: CompanyAccountNotesHistoryRow = {
      at: iso(r.createdAt),
      action: r.action as CompanyAccountNotesHistoryRow["action"],
      note: null,
      attachment: null,
    };
    if (!r.newValue) return base;
    try {
      const parsed = JSON.parse(r.newValue) as unknown;
      if (base.action === "COMPANY_ACCOUNT_NOTE_ADD" && parsed && typeof parsed === "object") {
        const note = (parsed as { note?: unknown }).note;
        if (typeof note === "string") base.note = note;
      }
      if (base.action === "COMPANY_ACCOUNT_ATTACHMENT_ADD" && parsed && typeof parsed === "object") {
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

  const openingBalance = Number(account.openingBalance || 0);
  const postedOutflow = Number(postedOutflowAgg._sum.amount || 0);
  const currentBalance = openingBalance - postedOutflow;

  const header: CompanyAccountDetailHeader = {
    id: account.id,
    name: account.name,
    type: account.type,
    status: account.isActive ? "ACTIVE" : "INACTIVE",
    currency: account.currency || "PKR",
    openingBalance,
    currentBalance,
    attachmentsCount,
  };

  // Payments tab (paged)
  const page = Math.max(args.paymentsPage || 1, 1);
  const take = 25;
  const skip = (page - 1) * take;
  const [paymentRows, paymentCount] = await Promise.all([
    prisma.vendorPayment.findMany({
      where: { companyAccountId: account.id },
      orderBy: { paymentDate: "desc" },
      skip,
      take,
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        status: true,
        projectRef: true,
        amount: true,
        vendor: { select: { id: true, name: true } },
        allocations: {
          select: {
            amount: true,
            vendorBill: { select: { billNumber: true, billDate: true, status: true } },
          },
        },
      },
    }),
    prisma.vendorPayment.count({ where: { companyAccountId: account.id } }),
  ]);

  const payments: CompanyAccountPaymentRow[] = paymentRows.map((p) => {
    const allocatedAmount = p.allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    return {
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: fmtDate(p.paymentDate),
      status: p.status,
      vendor: { id: p.vendor.id, name: p.vendor.name },
      projectRef: p.projectRef || null,
      amount: Number(p.amount || 0),
      allocatedAmount,
      href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
    };
  });

  const totalPages = Math.max(1, Math.ceil(paymentCount / take));

  // Summary: month-wise posted outflows (last 12 months)
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0));
  const postedRows = await prisma.vendorPayment.findMany({
    where: {
      companyAccountId: account.id,
      status: "POSTED",
      paymentDate: { gte: start },
    },
    select: { paymentDate: true, amount: true },
    orderBy: { paymentDate: "asc" },
  });

  const summaryMap = new Map<string, { sum: number; count: number }>();
  for (const row of postedRows) {
    const d = row.paymentDate;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const cur = summaryMap.get(key) || { sum: 0, count: 0 };
    cur.sum += Number(row.amount || 0);
    cur.count += 1;
    summaryMap.set(key, cur);
  }
  const summary: CompanyAccountSummaryRow[] = Array.from(summaryMap.entries())
    .map(([month, v]) => ({ month, postedOutflow: v.sum, postedCount: v.count }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // Documents: payments + allocated bills (current page)
  const documents: CompanyAccountDocumentRow[] = [];
  for (const p of paymentRows) {
    documents.push({
      type: "PAYMENT",
      number: p.paymentNumber,
      date: fmtDate(p.paymentDate),
      status: p.status,
      href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
    });
    for (const a of p.allocations) {
      documents.push({
        type: "BILL",
        number: a.vendorBill.billNumber,
        date: fmtDate(a.vendorBill.billDate),
        status: a.vendorBill.status,
        href: `/procurement/vendor-bills?search=${encodeURIComponent(a.vendorBill.billNumber)}`,
      });
    }
  }

  // Activity: payments (latest 50) + notes/attachments (latest 20), sorted.
  const latestPayments = await prisma.vendorPayment.findMany({
    where: { companyAccountId: account.id },
    orderBy: { paymentDate: "desc" },
    take: 50,
    select: {
      paymentNumber: true,
      paymentDate: true,
      status: true,
      amount: true,
      vendor: { select: { name: true } },
    },
  });

  const activity: CompanyAccountActivityRow[] = [];
  for (const p of latestPayments) {
    activity.push({
      at: iso(p.paymentDate),
      type: "PAYMENT",
      label: `Payment ${p.paymentNumber} → ${p.vendor.name}`,
      status: p.status,
      amount: Number(p.amount || 0),
      href: `/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`,
    });
  }
  for (const e of notesHistory) {
    if (e.note) {
      activity.push({
        at: e.at,
        type: "NOTE",
        label: `Note: ${e.note.slice(0, 120)}${e.note.length > 120 ? "…" : ""}`,
      });
    } else if (e.attachment) {
      activity.push({
        at: e.at,
        type: "ATTACHMENT",
        label: `Attachment: ${e.attachment.fileName}`,
        href: e.attachment.url,
      });
    }
  }
  activity.sort((a, b) => b.at.localeCompare(a.at));

  const data: CompanyAccountDetailData = {
    header,
    policy,
    notesHistory,
    activity,
    payments: { entries: payments, page, totalPages, totalCount: paymentCount },
    summary,
    documents: documents.slice(0, 200),
  };

  return { ok: true as const, status: 200 as const, data };
}

