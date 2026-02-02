# 📁 Automatrix ERP Project Structure

## 🏗️ Repository Organization

```
Automatrix-ERP/
├── 📋 MASTER_PLAN.md           # Complete roadmap and requirements
├── 📁 PROJECT_STRUCTURE.md     # This file - project organization
├── 📦 package.json            # Root workspace configuration
├── 🔧 pnpm-workspace.yaml     # PNPM workspace settings
│
├── 📂 apps/
│   └── 📱 web/                # Main Next.js application
│       ├── 🔧 Configuration Files
│       │   ├── next.config.ts
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   ├── tailwind.config.mjs
│       │   └── playwright.config.ts
│       │
│       ├── 🗄️ Database & Schema
│       │   └── prisma/
│       │       ├── schema.prisma        # SQLite database schema
│       │       ├── seed.js             # Database seeding
│       │       └── prisma/dev.db       # SQLite database file
│       │
│       ├── 📱 Application Source
│       │   └── src/
│       │       ├── 🎨 app/             # Next.js App Router
│       │       │   ├── (auth)/         # Auth route group
│       │       │   ├── api/            # API routes
│       │       │   ├── dashboard/      # Dashboard pages
│       │       │   ├── expenses/       # Expense management
│       │       │   ├── inventory/      # Inventory management
│       │       │   ├── projects/       # Project management
│       │       │   ├── employees/      # Employee management
│       │       │   ├── approvals/      # Approval workflows
│       │       │   └── layout.tsx      # Root layout
│       │       │
│       │       ├── 🧩 components/      # React components
│       │       │   ├── ui/             # Base UI components (shadcn/ui)
│       │       │   ├── CategoryAutoComplete.tsx
│       │       │   ├── PaymentModeAutoComplete.tsx
│       │       │   ├── ProjectAutoComplete.tsx
│       │       │   ├── ExpenseForm.tsx
│       │       │   ├── InventoryForm.tsx
│       │       │   └── ...
│       │       │
│       │       └── 🔧 lib/             # Utility libraries
│       │           ├── auth.ts         # Authentication config
│       │           ├── prisma.ts       # Prisma client
│       │           ├── permissions.ts  # RBAC permissions
│       │           ├── dashboard.ts    # Dashboard utilities
│       │           └── utils.ts        # General utilities
│       │
│       ├── 📁 scripts/                 # Build & utility scripts
│       │   └── import-excel-data.mjs   # Legacy data import
│       │
│       ├── 🎭 playwright/              # E2E testing
│       │   └── tests/
│       │       ├── auth.spec.ts
│       │       └── login.spec.ts
│       │
│       └── 📄 public/                  # Static assets
│           └── favicon.ico
│
├── 📂 data/
│   └── legacy/
│       └── Automatrix_ERP.xlsx        # Original Google Sheets export
│
├── 📂 archive/                         # Organized archived files
│   ├── old_files/                     # Old project artifacts
│   │   ├── nested_apps_folder/        # Cleaned up nested structure
│   │   ├── nextapp/                   # Old Next.js attempt
│   │   └── prisma-old/                # Old Prisma config
│   │
│   ├── legacy_exports/                # Legacy data exports
│   │
│   └── temp_files/                    # Temporary files
│       ├── tmp_rovodev_database_fix_summary.md
│       ├── start-web-dev.sh
│       ├── dev.db
│       └── schema backups...
│
├── 📂 docs/                           # Documentation
│   ├── api/                          # API documentation
│   └── user-guides/                  # User manuals
│
└── 📂 legacy/                         # Legacy system references
    ├── appsheet/                     # AppSheet configurations
    └── google-sheets/                # Google Sheets scripts
```

## 🎯 Key Features by Directory

### `/apps/web/src/app/`
- **api/**: RESTful API endpoints for all business entities
- **dashboard/**: Business intelligence and analytics
- **expenses/**: Expense submission, approval, and tracking
- **inventory/**: Stock management and warehouse operations
- **projects/**: Project management and profitability tracking
- **employees/**: Staff management and wallet system
- **approvals/**: Multi-level approval workflows

### `/apps/web/src/components/`
- **ui/**: Base components (Button, Input, Modal, etc.)
- **AutoComplete components**: Consistent dropdown experiences
- **Form components**: Standardized data entry forms
- **Chart components**: Financial and business analytics

### `/apps/web/src/lib/`
- **auth.ts**: NextAuth.js configuration with Google OAuth + credentials
- **prisma.ts**: Database connection and ORM client
- **permissions.ts**: Role-based access control (RBAC)
- **dashboard.ts**: Business metrics and analytics calculations

## 🛠️ Development Setup

### Prerequisites
```bash
Node.js 18+ 
PNPM 8+
SQLite 3
```

### Quick Start
```bash
# Install dependencies
pnpm install

# Set up database
cd apps/web
cp .env.example .env.local
pnpm prisma db push
pnpm prisma:seed

# Start development server
pnpm dev

# Run tests
pnpm test
pnpm test:e2e
```

## 📋 Business Entities

### Core Entities
1. **Users** - Authentication and user management
2. **Employees** - Staff with wallet balances and roles
3. **Projects** - Client projects with financial tracking
4. **Expenses** - Expense submissions and approvals
5. **Income** - Revenue tracking and milestone payments
6. **Inventory** - Stock items and warehouse management
7. **Approvals** - Multi-level approval workflows

### Support Entities
8. **Roles & Permissions** - RBAC system
9. **Wallet Ledger** - Employee wallet transactions
10. **Inventory Ledger** - Stock movement history
11. **Audit Logs** - Change tracking and compliance

## 🔄 Data Flow

### Expense Workflow
```
Employee → Submit Expense → Manager Review → Approval → Payment → Wallet Update
```

### Inventory Workflow  
```
Purchase → Stock Entry → Project Allocation → Stock Deduction → Reorder Alert
```

### Project Workflow
```
Project Creation → Budget Setup → Expense Tracking → Milestone Billing → Profitability Analysis
```

## 🚀 Next Phase Implementation

Based on the MASTER_PLAN.md, the immediate priorities are:

1. **Fix Category Management** - Standardize dropdown components
2. **Form Consistency** - Ensure all forms use autocomplete patterns  
3. **Master Data Management** - Centralized category/supplier management
4. **Enhanced Project Integration** - Connect expenses to project budgets
5. **Advanced Reporting** - Business intelligence dashboards

---

**Maintained by**: Development Team  
**Last Updated**: February 2, 2026  
**Version**: 2.0 (Post-Google Sheets Migration)