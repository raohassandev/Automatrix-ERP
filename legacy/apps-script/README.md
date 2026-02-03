# Legacy AutoMatrix ERP - Google Apps Script

This `README.md` describes the legacy Google Apps Script version of the AutoMatrix ERP system. For the overall monorepo structure and the new Next.js application, please refer to the main [README.md](../../README.md) at the repository root.

## 🎯 Overview

AutoMatrix ERP is a comprehensive, enterprise-grade ERP system built on Google Apps Script and Google Sheets. It provides a complete solution for managing expenses, income, inventory, projects, and approvals with advanced features like multi-level approvals, audit trails, and role-based access control.

## ✨ Key Features

### Current Features (v6.0)

- ✅ **Modular Architecture** - Clean, maintainable codebase
- ✅ **Role-Based Access Control** - CEO, Finance Manager, Manager, Staff roles
- ✅ **Audit Trail** - Complete logging of all actions
- ✅ **Multi-Level Approvals** - Amount-based approval routing
- ✅ **Expense Management** - Submit, track, and approve expenses
- ✅ **Income Tracking** - Record and monitor income
- ✅ **Inventory Management** - Track stock levels
- ✅ **Project Management** - Track projects and budgets
- ✅ **Employee Management** - Manage team and wallet balances
- ✅ **Responsive UI** - Works on desktop and mobile
- ✅ **Concurrent Access Protection** - LockService integration

## 🚀 Quick Start

### Prerequisites

- Google Account
- Google Apps Script project
- Google Sheets spreadsheet

### Installation

#### **Option 1: Automated Deployment** (Recommended) ⚡

**One-Time Setup (5 minutes):**

```bash
# Run setup wizard
./scripts/setup-clasp.sh
```

**Deploy Anytime (30 seconds):**

```bash
# Automated deployment
./scripts/auto-deploy.sh
```

See [QUICK_DEPLOY.md](./scripts/QUICK_DEPLOY.md) for details.

#### **Option 2: Manual Deployment**

1. **Create Google Sheets Spreadsheet**

   ```
   File → New → Google Sheets
   ```

2. **Open Apps Script Editor**

   ```
   Extensions → Apps Script
   ```

3. **Build & Copy Files**

   ```bash
   # Build deployment package
   ./scripts/deploy.sh

   # Copy content of script.gs to Apps Script Code.gs
   # Copy src/client/Index.html to Apps Script Index.html
   ```

4. **Initialize System**

   ```javascript
   // Run this function once in Apps Script editor
   initializeSystem();
   ```

5. **Deploy as Web App**

   ```
   Deploy → New deployment
   Type: Web app
   Execute as: Me
   Who has access: Anyone with link
   ```

6. **Set Up Initial Data**
   - Add employees to "Employees" sheet
   - Configure categories and projects
   - Set user roles (CEO, Finance Manager, Manager, Staff)

## 📚 Documentation

- **[MASTER_PLAN.md](../../docs/product/MASTER_PLAN.md)** - Complete implementation roadmap with all features
- **[STRUCTURE_GUIDE.md](../../docs/tech/STRUCTURE_GUIDE.md)** - Architecture and code organization
- **[DEPLOYMENT_GUIDE.md](../../docs/tech/DEPLOYMENT_GUIDE.md)** - Detailed deployment instructions
- **[CURRENT_SYSTEM_ANALYSIS.md](../../docs/tech/SYSTEM_ANALYSIS.md)** - System analysis

## 🏗️ Architecture

### Modular Design

The system follows a clean, layered architecture:

```
┌─────────────────────────────────────┐
│         Frontend (Index.html)       │
├─────────────────────────────────────┤
│       API Layer (main.gs)           │
├─────────────────────────────────────┤
│  Business Modules (expenses.gs,    │
│  income.gs, approvals.gs, etc.)     │
├─────────────────────────────────────┤
│  Core Services (auth, validation,   │
│  audit, locks)                      │
├─────────────────────────────────────┤
│  Utilities (sheets, date,           │
│  formatting)                        │
├─────────────────────────────────────┤
│  Configuration (constants,          │
│  permissions, schema)               │
└─────────────────────────────────────┘
```

### Key Design Principles

1. **Separation of Concerns** - Each module has a single responsibility
2. **Reusability** - Common utilities shared across modules
3. **Security** - Permission checks and validation at every layer
4. **Auditability** - All actions logged for compliance
5. **Scalability** - Modular design allows easy feature additions

## 🔐 Security

### Role-Based Access Control (RBAC)

| Role                | Permissions                                              |
| ------------------- | -------------------------------------------------------- |
| **CEO/Owner**       | Full access to all features                              |
| **Finance Manager** | Approve high amounts, view all financials, manage income |
| **Manager**         | Approve low amounts, view team data, submit expenses     |
| **Staff**           | Submit expenses, view own data                           |
| **Guest**           | Limited read-only access                                 |

### Approval Thresholds

| Amount Range           | Required Approver |
| ---------------------- | ----------------- |
| PKR 0 - PKR 5,000      | Manager           |
| PKR 5,001 - PKR 50,000 | Finance Manager   |
| > PKR 50,000           | CEO               |

### Security Features

- ✅ Server-side permission checks
- ✅ Input validation and sanitization
- ✅ Audit trail for all actions
- ✅ Concurrent access protection
- ✅ Role-based data filtering

## 📊 Data Model

### Core Sheets

1. **Expenses** - Track all expenses with approval workflow
2. **Income** - Record income entries
3. **Employees** - Employee data and roles
4. **Inventory** - Stock items and quantities
5. **Projects** - Project tracking and budgets
6. **Wallet** - Employee wallet transactions
7. **AuditLog** - Complete audit trail
8. **InventoryLedger** - Inventory transactions (coming soon)
9. **Invoices** - Invoice tracking (coming soon)

## 🛠️ Development

### Prerequisites

- Basic knowledge of JavaScript
- Understanding of Google Apps Script
- Familiarity with Google Sheets

### Adding a New Feature

1. Update schema in `src/server/config/schema.gs`
2. Add validation in `src/server/core/validation.gs`
3. Create module function in appropriate file
4. Add audit logging
5. Update frontend
6. Test thoroughly
7. Deploy

### Testing

Run manual tests for:

- User authentication
- Permission enforcement
- Data validation
- Approval workflow
- Concurrent operations
- Audit trail completeness

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards
4. Add tests for new features
5. Submit a pull request

## 📝 License

This project is proprietary software. All rights reserved.

## 👥 Team

- **Development**: AI Agent + Israr Ul Haq
- **Version**: 6.0
- **Last Updated**: January 27, 2026

## 📞 Support

For issues or questions:

- Review documentation in `docs/` folder
- Check [MASTER_PLAN.md](../../docs/product/MASTER_PLAN.md) for feature status
- See [STRUCTURE_GUIDE.md](../../docs/tech/STRUCTURE_GUIDE.md) for architecture details

## 🎉 Acknowledgments

Built with:

- Google Apps Script
- Google Sheets
- HTML5/CSS3/JavaScript
- Lots of ☕

---

**Status**: Modular Architecture Complete ✅  
**Next Phase**: Business Module Implementation  
**Version**: 6.0  
**Date**: January 27, 2026
