import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const roles = ["Owner", "CEO", "Finance Manager", "Manager", "Staff", "Guest"];

const permissions = [
  "dashboard.view",
  "dashboard.view_all_metrics",
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
];

const rolePermissionMap = {
  Owner: ["*"],
  CEO: ["*"],
  "Finance Manager": [
    "dashboard.view",
    "dashboard.view_all_metrics",
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
};

async function main() {
  const existingRoles = await prisma.role.findMany();
  if (existingRoles.length === 0) {
    await prisma.role.createMany({ data: roles.map((name) => ({ name })) });
  }

  const existingPermissions = await prisma.permission.findMany();
  if (existingPermissions.length === 0) {
    await prisma.permission.createMany({
      data: permissions.map((key) => ({ key })),
    });
  }

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
