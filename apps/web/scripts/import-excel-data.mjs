#!/usr/bin/env node
/**
 * Import data from Automatrix_ERP.xlsx into the database
 * Run with: node scripts/import-excel-data.mjs
 */

import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Excel serial date to JS Date conversion
function excelDateToJSDate(excelDate) {
  if (!excelDate || excelDate === 0) return new Date();
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + excelDate * 86400000);
}

// Helper to normalize email
function normalizeEmail(email) {
  return email?.toLowerCase().trim() || '';
}

// Helper to get or create user
async function getOrCreateUser(email, name, role) {
  const normalizedEmail = normalizeEmail(email);
  
  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  
  if (!user) {
    const password = 'Password'; // Default password for imported users
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Get role from database
    const dbRole = await prisma.role.findFirst({
      where: { name: { in: ['Owner', 'CEO', 'Manager', 'Staff'] } }
    });
    
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || email.split('@')[0],
        passwordHash,
        roleId: dbRole?.id
      }
    });
    
    console.log(`  ✅ Created user: ${user.email}`);
  }
  
  return user;
}

async function importData() {
  console.log('📊 Starting data import from Excel...\n');
  
  // Default to the repo copy of the Excel file. Allow override via CLI:
  //   node scripts/import-excel-data.mjs --file ../../data/legacy/Automatrix_ERP.xlsx
  const fileArgIndex = process.argv.findIndex((a) => a === "--file");
  const filePath = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : "../../data/legacy/Automatrix_ERP.xlsx";

  const workbook = XLSX.readFile(filePath);
  
  let stats = {
    users: 0,
    employees: 0,
    projects: 0,
    expenses: 0,
    income: 0,
    inventory: 0,
    inventoryLedger: 0,
    walletLedger: 0,
    errors: []
  };

  try {
    // 1. Import Projects (including internal projects)
    console.log('📁 Importing Projects...');
    const projectsData = XLSX.utils.sheet_to_json(workbook.Sheets['Projects']);
    
    for (const row of projectsData) {
      try {
        // Parse project data (note: Excel has messy column mapping)
        const projectId = row['Project ID'];
        const projectName = row['Name'];
        const client = row['Client'] || 'Unknown';
        
        const project = await prisma.project.upsert({
          where: { projectId: projectId || `P-${Date.now()}` },
          update: {
            name: projectName,
            client: client,
            status: 'ACTIVE',
            contractValue: parseFloat(row['Contract Value']) || 0,
            invoicedAmount: parseFloat(row['Invoiced Amount']) || 0,
            receivedAmount: parseFloat(row['Received Amount']) || 0,
          },
          create: {
            projectId: projectId || `P-${Date.now()}`,
            name: projectName,
            client: client,
            startDate: new Date(),
            status: 'ACTIVE',
            contractValue: parseFloat(row['Contract Value']) || 0,
            invoicedAmount: parseFloat(row['Invoiced Amount']) || 0,
            receivedAmount: parseFloat(row['Received Amount']) || 0,
            pendingRecovery: 0,
            costToDate: 0,
            grossMargin: 0,
            marginPercent: 0,
          }
        });
        
        console.log(`  ✅ Created project: ${project.name}`);
        stats.projects++;
      } catch (error) {
        console.error(`  ❌ Error importing project: ${error.message}`);
        stats.errors.push(`Project: ${row['Name']} - ${error.message}`);
      }
    }

    // 2. Import Employees
    console.log('\n👥 Importing Employees...');
    const employeesData = XLSX.utils.sheet_to_json(workbook.Sheets['Employees']);
    const uniqueEmployees = new Map();
    
    // Deduplicate employees by email
    for (const row of employeesData) {
      const email = normalizeEmail(row['Email']);
      if (email && !uniqueEmployees.has(email)) {
        uniqueEmployees.set(email, row);
      }
    }
    
    for (const [email, row] of uniqueEmployees) {
      try {
        // The data seems to have Name and Phone swapped
        const name = row['Phone'] || row['Name'] || email.split('@')[0];
        const role = row['Role'] || 'Staff';
        const walletBalance = parseFloat(row['Wallet Balance']) || 0;
        const phone = row['Status'] || '';
        
        // Create user first
        const user = await getOrCreateUser(email, name, role);
        stats.users++;
        
        // Create or update employee
        const employee = await prisma.employee.upsert({
          where: { email },
          create: {
            email,
            name,
            phone: phone.toString(),
            role,
            walletBalance,
            status: 'ACTIVE'
          },
          update: {
            name,
            phone: phone.toString(),
            role,
            walletBalance
          }
        });
        
        console.log(`  ✅ Created employee: ${employee.name} (${employee.email})`);
        stats.employees++;
      } catch (error) {
        console.error(`  ❌ Error importing employee ${email}: ${error.message}`);
        stats.errors.push(`Employee: ${email} - ${error.message}`);
      }
    }

    // 3. Import Inventory Items
    console.log('\n📦 Importing Inventory Items...');
    const inventoryData = XLSX.utils.sheet_to_json(workbook.Sheets['Inventory_Items']);
    
    for (const row of inventoryData) {
      try {
        const unitCost = parseFloat(row['Purchase_Price']) || 0;
        const quantity = parseFloat(row['Current_Stock']) || 0;
        
        const item = await prisma.inventoryItem.create({
          data: {
            name: row['Item_Name'],
            category: row['Category'] || 'General',
            unit: row['Unit'] || 'Piece',
            quantity: quantity,
            unitCost: unitCost,
            totalValue: quantity * unitCost,
            minStock: 0,
            reorderQty: 0,
            reservedQty: 0,
            availableQty: quantity,
            lastUpdated: new Date(),
          }
        });
        
        console.log(`  ✅ Created inventory item: ${item.name}`);
        stats.inventory++;
      } catch (error) {
        console.error(`  ❌ Error importing inventory: ${error.message}`);
        stats.errors.push(`Inventory: ${row['Item_Name']} - ${error.message}`);
      }
    }

    // 4. Import Inventory Ledger
    console.log('\n📋 Importing Inventory Ledger...');
    const inventoryLogsData = XLSX.utils.sheet_to_json(workbook.Sheets['Inventory_Logs']);
    
    for (const row of inventoryLogsData) {
      try {
        const itemName = row['Item_ID'];
        const item = await prisma.inventoryItem.findFirst({
          where: { name: { contains: itemName } }
        });
        
        if (!item) {
          console.log(`  ⏭️  Skipping log for unknown item: ${itemName}`);
          continue;
        }
        
        const actionStr = row['Action'];
        let ledgerType = 'PURCHASE';
        if (actionStr.includes('Purchase')) ledgerType = 'PURCHASE';
        else if (actionStr.includes('Return')) ledgerType = 'RETURN';
        else if (actionStr.includes('Sale')) ledgerType = 'SALE';
        else if (actionStr.includes('Adjustment')) ledgerType = 'ADJUSTMENT';
        
        const quantity = parseFloat(row['Qty']) || 0;
        const date = excelDateToJSDate(row['Timestamp']);
        const unitCost = item.unitCost;
        const total = quantity * unitCost;
        
        const ledger = await prisma.inventoryLedger.create({
          data: {
            itemId: item.id,
            type: ledgerType,
            quantity,
            unitCost,
            total,
            date,
            reference: row['Log_ID'],
            project: row['Project_Ref'],
            runningBalance: item.quantity + (ledgerType === 'PURCHASE' || ledgerType === 'RETURN' ? quantity : -quantity)
          }
        });
        
        console.log(`  ✅ Created ledger entry: ${item.name} (${action} ${quantity})`);
        stats.inventoryLedger++;
      } catch (error) {
        console.error(`  ❌ Error importing ledger: ${error.message}`);
        stats.errors.push(`Ledger: ${row['Log_ID']} - ${error.message}`);
      }
    }

    // 5. Import Income
    console.log('\n💰 Importing Income...');
    const incomeData = XLSX.utils.sheet_to_json(workbook.Sheets['Income_Log']);
    
    for (const row of incomeData) {
      try {
        const date = excelDateToJSDate(row['Date']);
        const amount = parseFloat(row['Amount']) || 0;
        
        // Get first user as addedBy
        const firstUser = await prisma.user.findFirst();
        if (!firstUser) {
          console.log('  ⏭️  Skipping income - no users in database');
          continue;
        }
        
        const externalId = row['ID'] ? String(row['ID']) : null;
        const income = externalId
          ? await prisma.income.upsert({
              where: { externalId },
              update: {
                date,
                source: row['Client_Name (Auto)'] || 'Unknown',
                amount,
                category: row['Milestone'] || 'General',
                project: row['Project_Ref'],
                paymentMode: row['Payment_Mode'] || 'Cash',
                status: row['Status'] === 'Received' ? 'APPROVED' : 'PENDING',
                addedById: firstUser.id,
              },
              create: {
                externalId,
                date,
                source: row['Client_Name (Auto)'] || 'Unknown',
                amount,
                category: row['Milestone'] || 'General',
                project: row['Project_Ref'],
                paymentMode: row['Payment_Mode'] || 'Cash',
                status: row['Status'] === 'Received' ? 'APPROVED' : 'PENDING',
                addedById: firstUser.id,
              },
            })
          : await prisma.income.create({
              data: {
                date,
                source: row['Client_Name (Auto)'] || 'Unknown',
                amount,
                category: row['Milestone'] || 'General',
                project: row['Project_Ref'],
                paymentMode: row['Payment_Mode'] || 'Cash',
                status: row['Status'] === 'Received' ? 'APPROVED' : 'PENDING',
                addedById: firstUser.id,
              },
            });
        
        console.log(`  ✅ Created income: ${income.source} - ${amount}`);
        stats.income++;
      } catch (error) {
        console.error(`  ❌ Error importing income: ${error.message}`);
        stats.errors.push(`Income: ${row['ID']} - ${error.message}`);
      }
    }

    // 6. Import Transactions/Expenses
    console.log('\n💳 Importing Transactions...');
    const transactionsData = XLSX.utils.sheet_to_json(workbook.Sheets['Transactions']);
    
    for (const row of transactionsData) {
      try {
        const date = excelDateToJSDate(row['Timestamp']);
        const amount = Math.abs(parseFloat(row['Amount']) || 0);
        const type = row['Type'];
        const category = row['Category'] || 'General';
        const employeeEmail = normalizeEmail(row['Employee_Email']);
        
        // Find employee
        let employee = null;
        let submittedByUser = null;
        if (employeeEmail) {
          employee = await prisma.employee.findUnique({
            where: { email: employeeEmail }
          });
          submittedByUser = await prisma.user.findUnique({
            where: { email: employeeEmail }
          });
        }
        
        // Get first user if submitter not found
        if (!submittedByUser) {
          submittedByUser = await prisma.user.findFirst();
        }
        
        if (!submittedByUser) {
          console.log(`  ⏭️  Skipping transaction ${row['ID']} - no users in database`);
          continue;
        }
        
        // Determine if it's an expense or wallet transaction
        if (type === 'Cash Advance') {
          // Create wallet ledger entry (credit to employee)
          if (employee) {
            const currentBalance = employee.walletBalance || 0;
            const newBalance = parseFloat(currentBalance) + amount;
            
            const walletEntry = await prisma.walletLedger.create({
              data: {
                employeeId: employee.id,
                type: 'CREDIT',
                amount,
                date,
                reference: row['ID'],
                balance: newBalance
              }
            });
            
            // Update employee wallet balance
            await prisma.employee.update({
              where: { id: employee.id },
              data: { walletBalance: newBalance }
            });
            
            console.log(`  ✅ Created wallet entry: ${employee.name} +${amount}`);
            stats.walletLedger++;
          }
        } else {
          // Create expense
          const externalId = row['ID'] ? String(row['ID']) : null;
          const expense = externalId
            ? await prisma.expense.upsert({
                where: { externalId },
                update: {
                  date,
                  category,
                  amount,
                  description: row['Description'] || '',
                  project: row['Project_Ref'],
                  paymentMode: type.includes('Direct') ? 'Bank Transfer' : 
                              type.includes('Company Account') ? 'Bank Transfer' : 'Cash',
                  submittedById: submittedByUser.id,
                  status: row['Status'] === 'Approved' ? 'APPROVED' : 
                          row['Status'] === 'Pending' ? 'PENDING' : 'APPROVED',
                  receiptUrl: row['Receipt_Image'] || null,
                },
                create: {
                  externalId,
                  date,
                  category,
                  amount,
                  description: row['Description'] || '',
                  project: row['Project_Ref'],
                  paymentMode: type.includes('Direct') ? 'Bank Transfer' : 
                              type.includes('Company Account') ? 'Bank Transfer' : 'Cash',
                  submittedById: submittedByUser.id,
                  status: row['Status'] === 'Approved' ? 'APPROVED' : 
                          row['Status'] === 'Pending' ? 'PENDING' : 'APPROVED',
                  receiptUrl: row['Receipt_Image'] || null,
                }
              })
            : await prisma.expense.create({
                data: {
                  date,
                  category,
                  amount,
                  description: row['Description'] || '',
                  project: row['Project_Ref'],
                  paymentMode: type.includes('Direct') ? 'Bank Transfer' : 
                              type.includes('Company Account') ? 'Bank Transfer' : 'Cash',
                  submittedById: submittedByUser.id,
                  status: row['Status'] === 'Approved' ? 'APPROVED' : 
                          row['Status'] === 'Pending' ? 'PENDING' : 'APPROVED',
                  receiptUrl: row['Receipt_Image'] || null
                }
              });
          
          console.log(`  ✅ Created expense: ${category} - ${amount}`);
          stats.expenses++;
          
          // If employee paid, create debit wallet entry
          if (type === 'Expense (Employee Paid)' && employee) {
            const currentBalance = employee.walletBalance || 0;
            const newBalance = parseFloat(currentBalance) - amount;
            
            await prisma.walletLedger.create({
              data: {
                employeeId: employee.id,
                type: 'DEBIT',
                amount,
                date,
                reference: expense.id,
                balance: newBalance
              }
            });
            
            // Update employee wallet balance
            await prisma.employee.update({
              where: { id: employee.id },
              data: { walletBalance: newBalance }
            });
            
            stats.walletLedger++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error importing transaction ${row['ID']}: ${error.message}`);
        stats.errors.push(`Transaction: ${row['ID']} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ IMPORT COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   Users created: ${stats.users}`);
    console.log(`   Employees: ${stats.employees}`);
    console.log(`   Projects: ${stats.projects}`);
    console.log(`   Expenses: ${stats.expenses}`);
    console.log(`   Income: ${stats.income}`);
    console.log(`   Inventory Items: ${stats.inventory}`);
    console.log(`   Inventory Ledger: ${stats.inventoryLedger}`);
    console.log(`   Wallet Ledger: ${stats.walletLedger}`);
    console.log(`   Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    console.log('\n💡 Note: All imported users have default password: "Password"');
    console.log('   Please ask users to change their passwords after first login.');
    
  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importData().catch(console.error);
