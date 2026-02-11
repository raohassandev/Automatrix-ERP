import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const roles = [
  "Owner",
  "CEO",
  "Admin",
  "CFO",
  "Accountant",
  "Finance Manager",
  "Manager",
  "Marketing",
  "Sales",
  "Engineering",
  "HR",
  "Procurement",
  "Staff",
  "Guest",
];

const permissions = [
  "dashboard.view",
  "dashboard.view_all_metrics",
  "clients.view_all",
  "clients.edit",
  "quotations.view_all",
  "expenses.view_all",
  "expenses.view_own",
  "expenses.submit",
  "expenses.approve_high",
  "expenses.approve_medium",
  "expenses.approve_low",
  "expenses.reject",
  "expenses.edit",
  "income.view_all",
  "income.view_own",
  "income.add",
  "income.edit",
  "income.approve_high",
  "income.approve_low",
  "approvals.view_all",
  "approvals.view_pending",
  "approvals.approve_high",
  "approvals.approve_low",
  "approvals.partial_approve",
  "inventory.view",
  "inventory.adjust",
  "inventory.request",
  "inventory.approve_adjustment",
  "projects.view_all",
  "projects.view_assigned",
  "projects.view_financials",
  "projects.edit",
  "projects.update_status",
  "invoices.view_all",
  "invoices.create",
  "invoices.edit",
  "reports.view_all",
  "reports.view_team",
  "reports.view_own",
  "reports.export",
  "employees.view_all",
  "employees.view_team",
  "employees.view_own",
  "employees.edit_wallet",
  "notifications.view_all",
  "notifications.edit",
  "attachments.view_all",
  "attachments.edit",
  "categories.manage",
];

const rolePermissionMap = {
  Owner: ["*"],
  CEO: ["*"],
  Admin: [
    "dashboard.view",
    "dashboard.view_all_metrics",
    "clients.view_all",
    "clients.edit",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.edit",
    "income.view_all",
    "income.add",
    "income.edit",
    "approvals.view_all",
    "inventory.view",
    "inventory.adjust",
    "inventory.approve_adjustment",
    "projects.view_all",
    "projects.edit",
    "projects.view_financials",
    "projects.update_status",
    "invoices.view_all",
    "invoices.create",
    "invoices.edit",
    "reports.view_all",
    "reports.export",
    "employees.view_all",
    "employees.edit_wallet",
  ],
  CFO: [
    "dashboard.view",
    "dashboard.view_all_metrics",
    "clients.view_all",
    "clients.edit",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.approve_high",
    "expenses.approve_medium",
    "expenses.approve_low",
    "expenses.reject",
    "expenses.edit",
    "income.view_all",
    "income.add",
    "income.edit",
    "income.approve_high",
    "income.approve_low",
    "approvals.view_all",
    "approvals.approve_high",
    "approvals.partial_approve",
    "inventory.view",
    "inventory.adjust",
    "inventory.approve_adjustment",
    "projects.view_all",
    "projects.edit",
    "projects.view_financials",
    "invoices.view_all",
    "invoices.create",
    "invoices.edit",
    "reports.view_all",
    "reports.export",
    "employees.view_all",
    "employees.edit_wallet",
  ],
  Accountant: [
    "dashboard.view",
    "clients.view_all",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.edit",
    "income.view_all",
    "income.add",
    "income.edit",
    "approvals.view_pending",
    "inventory.view",
    "projects.view_all",
    "projects.view_financials",
    "invoices.view_all",
    "invoices.create",
    "invoices.edit",
    "reports.view_all",
    "reports.export",
    "employees.view_all",
    "employees.edit_wallet",
  ],
  "Finance Manager": [
    "dashboard.view",
    "dashboard.view_all_metrics",
    "clients.view_all",
    "clients.edit",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.approve_high",
    "expenses.approve_medium",
    "expenses.approve_low",
    "expenses.reject",
    "expenses.edit",
    "income.view_all",
    "income.add",
    "income.edit",
    "income.approve_high",
    "income.approve_low",
    "approvals.view_all",
    "approvals.approve_high",
    "approvals.partial_approve",
    "inventory.view",
    "inventory.adjust",
    "inventory.approve_adjustment",
    "projects.view_all",
    "projects.edit",
    "projects.view_financials",
    "invoices.view_all",
    "invoices.create",
    "invoices.edit",
    "reports.view_all",
    "reports.export",
    "employees.view_all",
    "employees.edit_wallet",
  ],
  Manager: [
    "dashboard.view",
    "clients.view_all",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.submit",
    "expenses.approve_low",
    "expenses.reject",
    "income.view_all",
    "income.add",
    "approvals.view_pending",
    "approvals.approve_low",
    "inventory.view",
    "inventory.request",
    "projects.view_all",
    "projects.view_assigned",
    "projects.update_status",
    "reports.view_team",
    "employees.view_team",
  ],
  Staff: [
    "dashboard.view",
    "expenses.view_own",
    "expenses.submit",
    "income.view_own",
    "inventory.view",
    "inventory.request",
    "projects.view_assigned",
    "reports.view_own",
    "employees.view_own",
  ],
  Guest: ["dashboard.view"],
  Marketing: [
    "dashboard.view",
    "clients.view_all",
    "quotations.view_all",
    "projects.view_all",
    "projects.view_assigned",
    "projects.update_status",
    "reports.view_team",
  ],
  Sales: [
    "dashboard.view",
    "clients.view_all",
    "quotations.view_all",
    "projects.view_all",
    "projects.view_assigned",
    "invoices.view_all",
    "reports.view_team",
  ],
  Engineering: [
    "dashboard.view",
    "expenses.view_own",
    "expenses.submit",
    "inventory.view",
    "inventory.request",
    "projects.view_assigned",
    "reports.view_own",
  ],
  HR: [
    "dashboard.view",
    "employees.view_all",
    "employees.view_team",
    "reports.view_team",
  ],
  Procurement: [
    "dashboard.view",
    "expenses.view_own",
    "expenses.submit",
    "inventory.view",
    "inventory.request",
    "inventory.adjust",
    "projects.view_assigned",
    "reports.view_own",
  ],
};

async function main() {
  await prisma.role.createMany({
    data: roles.map((name) => ({ name })),
    skipDuplicates: true,
  });

  await prisma.permission.createMany({
    data: permissions.map((key) => ({ key })),
    skipDuplicates: true,
  });

  const dbRoles = await prisma.role.findMany();
  const dbPermissions = await prisma.permission.findMany();

  for (const role of dbRoles) {
    const allowed = rolePermissionMap[role.name] || [];
    if (allowed.includes("*")) {
      for (const perm of dbPermissions) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    } else {
      for (const permKey of allowed) {
        const perm = dbPermissions.find((p) => p.key === permKey);
        if (!perm) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const ownerRole = await prisma.role.findUnique({ where: { name: "Owner" } });
    if (ownerRole) {
      const user = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (user) {
        await prisma.user.update({ where: { email: adminEmail }, data: { roleId: ownerRole.id } });
      }
    }
  }

  const existingClients = await prisma.client.findMany();
  if (existingClients.length === 0) {
    const client = await prisma.client.create({
      data: {
        name: "Fouz Energy",
        description: "Automation and engineering services",
        address: "Lahore, Pakistan",
        contacts: {
          create: [
            {
              name: "Operations",
              phone: "+92-300-0000000",
              designation: "Coordinator",
            },
          ],
        },
      },
    });

    await prisma.project.create({
      data: {
        projectId: "AE-MON-CI-90",
        name: "ZKB Form House Project",
        clientId: client.id,
        startDate: new Date(),
        status: "ACTIVE",
        contractValue: 400000,
        invoicedAmount: 0,
        receivedAmount: 0,
        pendingRecovery: 0,
        costToDate: 0,
        grossMargin: 0,
        marginPercent: 0,
      },
    });
  }

  // Phase 1 ops defaults (safe, non-destructive):
  // - Ensure at least one warehouse exists (future-proof inventory ledger).
  // - Ensure minimal company accounts exist for payment/receipt attribution.
  const warehouseCount = await prisma.warehouse.count();
  if (warehouseCount === 0) {
    await prisma.warehouse.create({
      data: { name: "Main Warehouse", code: "MAIN", isDefault: true, isActive: true },
    });
  }

  const accountCount = await prisma.companyAccount.count();
  if (accountCount === 0) {
    await prisma.companyAccount.createMany({
      data: [
        { name: "Cash", type: "CASH", currency: "PKR", openingBalance: 0, isActive: true },
        { name: "Bank", type: "BANK", currency: "PKR", openingBalance: 0, isActive: true },
      ],
      skipDuplicates: true,
    });
  }

  // Dev/staging-only: optional role test users for RBAC QA.
  // This is guarded by an explicit env flag and must not run implicitly in production.
  const seedTestUsers = process.env.SEED_TEST_USERS === "1";
  const nextAuthUrl = (process.env.NEXTAUTH_URL || "").toLowerCase();
  const allowTestUsersHere =
    nextAuthUrl.includes("erp-staging.") || process.env.APP_ENV === "staging" || process.env.NODE_ENV !== "production";

  if (seedTestUsers && allowTestUsersHere) {
    const testUsers = [
      { email: "engineer1@automatrix.pk", roleName: "Engineering" },
      { email: "sales1@automatrix.pk", roleName: "Sales" },
      { email: "technician1@automatrix.pk", roleName: "Staff" },
      { email: "store1@automatrix.pk", roleName: "Store Keeper" },
      { email: "finance1@automatrix.pk", roleName: "Finance Manager" },
    ];

    for (const u of testUsers) {
      const role = await prisma.role.upsert({
        where: { name: u.roleName },
        update: {},
        create: { name: u.roleName },
      });

      await prisma.employee.upsert({
        where: { email: u.email },
        update: { status: "ACTIVE", role: u.roleName },
        create: {
          email: u.email,
          name: u.email.split("@")[0],
          role: u.roleName,
          status: "ACTIVE",
        },
      });

      await prisma.user.upsert({
        where: { email: u.email },
        update: { roleId: role.id, passwordHash: null },
        create: { email: u.email, name: u.email.split("@")[0], roleId: role.id, passwordHash: null },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
