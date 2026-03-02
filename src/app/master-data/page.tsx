import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function MasterDataPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [canClients, canVendors, canCategories, canDepartments, canDesignations, canInventory] =
    await Promise.all([
      requirePermission(session.user.id, "clients.view_all"),
      requirePermission(session.user.id, "vendors.view_all"),
      requirePermission(session.user.id, "categories.manage"),
      requirePermission(session.user.id, "departments.view_all"),
      requirePermission(session.user.id, "designations.view_all"),
      requirePermission(session.user.id, "inventory.view"),
    ]);

  if (!canClients && !canVendors && !canCategories && !canDepartments && !canDesignations && !canInventory) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Master Data Center</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to master data.</p>
      </div>
    );
  }

  const [clientsCount, vendorsStats, categoryStats, departmentsTotal, designationsTotal, itemStats, vendorsMissingContact] =
    await Promise.all([
      prisma.client.count(),
      prisma.vendor.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.category.groupBy({
        by: ["type"],
        where: { isActive: true },
        _count: { _all: true },
      }),
      prisma.department.count(),
      prisma.designation.count(),
      prisma.inventoryItem.aggregate({
        _count: { _all: true },
      }),
      prisma.vendor.count({
        where: {
          OR: [{ phone: null }, { email: null }],
        },
      }),
    ]);

  const vendorActive = vendorsStats
    .filter((v) => (v.status || "").toUpperCase() === "ACTIVE")
    .reduce((s, v) => s + v._count._all, 0);
  const vendorInactive = Math.max(
    0,
    vendorsStats.reduce((s, v) => s + v._count._all, 0) - vendorActive,
  );
  const expenseCategories =
    categoryStats.find((c) => (c.type || "").toLowerCase() === "expense")?._count._all || 0;
  const inventoryCategories =
    categoryStats.find((c) => (c.type || "").toLowerCase() === "inventory")?._count._all || 0;
  const incomeCategories =
    categoryStats.find((c) => (c.type || "").toLowerCase() === "income")?._count._all || 0;
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Master Data Center</h1>
        <p className="mt-2 text-muted-foreground">
          Maintain core reference data used by accounting, procurement, inventory, HR, and reporting.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
          <div className="text-sm text-sky-700">Clients</div>
          <div className="mt-2 text-2xl font-semibold text-sky-900">{clientsCount}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="text-sm text-emerald-700">Vendors (Active)</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-900">{vendorActive}</div>
          <div className="mt-1 text-xs text-amber-700">Inactive: {vendorInactive}</div>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="text-sm text-indigo-700">Inventory Items</div>
          <div className="mt-2 text-2xl font-semibold text-indigo-900">{itemStats._count._all || 0}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Master Data Quality</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use this checklist to keep transaction masters clean.</p>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
            Vendors missing phone/email: <span className="font-semibold">{vendorsMissingContact}</span>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3">
            Active expense categories: <span className="font-semibold">{expenseCategories}</span>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
            Departments + designations: <span className="font-semibold">{departmentsTotal + designationsTotal}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/clients" className="rounded-xl border bg-card p-5 shadow-sm hover:bg-accent/40">
          <div className="text-base font-semibold">Clients</div>
          <div className="mt-1 text-sm text-muted-foreground">Customer master records and contacts.</div>
        </Link>
        <Link href="/vendors" className="rounded-xl border bg-card p-5 shadow-sm hover:bg-accent/40">
          <div className="text-base font-semibold">Vendors</div>
          <div className="mt-1 text-sm text-muted-foreground">Supplier profiles, contact details, and status.</div>
        </Link>
        <Link href="/categories" className="rounded-xl border bg-card p-5 shadow-sm hover:bg-accent/40">
          <div className="text-base font-semibold">Categories</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Expense: {expenseCategories} | Inventory: {inventoryCategories} | Income: {incomeCategories}
          </div>
        </Link>
        <Link href="/departments" className="rounded-xl border bg-card p-5 shadow-sm hover:bg-accent/40">
          <div className="text-base font-semibold">Departments</div>
          <div className="mt-1 text-sm text-muted-foreground">Total departments: {departmentsTotal}</div>
        </Link>
        <Link href="/designations" className="rounded-xl border bg-card p-5 shadow-sm hover:bg-accent/40">
          <div className="text-base font-semibold">Designations</div>
          <div className="mt-1 text-sm text-muted-foreground">Total designations: {designationsTotal}</div>
        </Link>
        <Link href="/inventory" className="rounded-xl border bg-card p-5 shadow-sm hover:bg-accent/40">
          <div className="text-base font-semibold">Item Master</div>
          <div className="mt-1 text-sm text-muted-foreground">Item definitions and stock baseline controls.</div>
        </Link>
      </div>
    </div>
  );
}
