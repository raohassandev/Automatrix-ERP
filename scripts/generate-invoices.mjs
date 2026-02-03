#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateInvoices() {
  console.log('🧾 Generating invoices from project milestones...');

  // Get projects with costs but no invoices
  const projects = await prisma.project.findMany({
    where: {
      costToDate: { gt: 0 }
    },
    orderBy: { contractValue: 'desc' }
  });

  console.log(`📋 Found ${projects.length} projects with costs:`);

  for (const project of projects) {
    // Check if invoices already exist for this project
    const existingInvoices = await prisma.invoice.findMany({
      where: { projectId: project.projectId }
    });

    if (existingInvoices.length > 0) {
      console.log(`⏭️  Skipping ${project.name} - invoices already exist`);
      continue;
    }

    // Calculate invoice amounts based on project progress
    const costToDate = Number(project.costToDate);
    let contractValue = Number(project.contractValue);
    
    // If no contract value set, estimate based on cost + margin
    if (contractValue === 0) {
      if (project.client === 'Internal') {
        // Internal projects - minimal invoicing (cost recovery)
        contractValue = Math.round(costToDate * 1.1); // 10% overhead
      } else {
        // External client projects - standard contracting margin
        contractValue = Math.round(costToDate * 1.5); // 50% margin
      }
      
      // Update the project with estimated contract value
      await prisma.project.update({
        where: { id: project.id },
        data: { 
          contractValue,
          grossMargin: contractValue - costToDate,
          marginPercent: ((contractValue - costToDate) / contractValue) * 100
        }
      });
    }

    // Generate realistic milestone-based invoices
    const invoices = [];
    if (project.client === 'Internal') {
      // Internal projects: Single invoice for cost recovery
      invoices.push({
        invoiceNo: `INV-${project.projectId}-001`,
        amount: contractValue,
        description: 'Cost Recovery - Internal Operations',
        status: 'PAID', // Internal invoices are typically paid immediately
        daysFromStart: 30
      });
    } else {
      // External projects: Milestone-based billing
      if (contractValue <= 50000) {
        // Small projects: 50% down payment, 50% completion
        invoices.push({
          invoiceNo: `INV-${project.projectId}-001`,
          amount: Math.round(contractValue * 0.5),
          description: 'Project Down Payment (50%)',
          status: 'PAID',
          daysFromStart: 0
        });
        invoices.push({
          invoiceNo: `INV-${project.projectId}-002`,
          amount: contractValue - Math.round(contractValue * 0.5),
          description: 'Project Completion Payment (50%)',
          status: Math.random() > 0.3 ? 'PAID' : 'SENT', // 70% paid
          daysFromStart: 45
        });
      } else if (contractValue <= 150000) {
        // Medium projects: 30% down, 40% progress, 30% completion
        const downPayment = Math.round(contractValue * 0.3);
        const progressPayment = Math.round(contractValue * 0.4);
        const finalPayment = contractValue - downPayment - progressPayment;
        
        invoices.push({
          invoiceNo: `INV-${project.projectId}-001`,
          amount: downPayment,
          description: 'Project Down Payment (30%)',
          status: 'PAID',
          daysFromStart: 0
        });
        invoices.push({
          invoiceNo: `INV-${project.projectId}-002`, 
          amount: progressPayment,
          description: 'Progress Payment (40%)',
          status: Math.random() > 0.2 ? 'PAID' : 'SENT', // 80% paid
          daysFromStart: 30
        });
        invoices.push({
          invoiceNo: `INV-${project.projectId}-003`,
          amount: finalPayment,
          description: 'Final Payment (30%)',
          status: Math.random() > 0.4 ? 'PAID' : Math.random() > 0.5 ? 'SENT' : 'OVERDUE', // 60% paid, 20% sent, 20% overdue
          daysFromStart: 60
        });
      } else {
        // Large projects: 25% down, 25% materials, 30% progress, 20% completion
        const downPayment = Math.round(contractValue * 0.25);
        const materialsPayment = Math.round(contractValue * 0.25);
        const progressPayment = Math.round(contractValue * 0.3);
        const finalPayment = contractValue - downPayment - materialsPayment - progressPayment;
        
        invoices.push({
          invoiceNo: `INV-${project.projectId}-001`,
          amount: downPayment,
          description: 'Project Down Payment (25%)',
          status: 'PAID',
          daysFromStart: 0
        });
        invoices.push({
          invoiceNo: `INV-${project.projectId}-002`,
          amount: materialsPayment,
          description: 'Materials Payment (25%)',
          status: 'PAID',
          daysFromStart: 15
        });
        invoices.push({
          invoiceNo: `INV-${project.projectId}-003`,
          amount: progressPayment,
          description: 'Progress Payment (30%)',
          status: Math.random() > 0.15 ? 'PAID' : 'SENT', // 85% paid
          daysFromStart: 45
        });
        invoices.push({
          invoiceNo: `INV-${project.projectId}-004`,
          amount: finalPayment,
          description: 'Final Payment (20%)',
          status: Math.random() > 0.3 ? 'PAID' : Math.random() > 0.6 ? 'SENT' : 'OVERDUE', // 70% paid, 18% sent, 12% overdue
          daysFromStart: 75
        });
      }
    }

    // Create the invoices
    const baseDate = new Date(project.startDate || '2024-01-01');
    
    for (const invoiceData of invoices) {
      const invoiceDate = new Date(baseDate);
      invoiceDate.setDate(invoiceDate.getDate() + invoiceData.daysFromStart);
      
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 day payment terms
      
      await prisma.invoice.create({
        data: {
          invoiceNo: invoiceData.invoiceNo,
          projectId: project.projectId,
          date: invoiceDate,
          amount: invoiceData.amount,
          dueDate: dueDate,
          status: invoiceData.status,
          notes: invoiceData.description
        }
      });

      console.log(`✅ Created invoice ${invoiceData.invoiceNo} for ${project.name} - ${invoiceData.status} - $${invoiceData.amount.toLocaleString()}`);
    }
  }

  // Update project invoiced amounts
  for (const project of projects) {
    const projectInvoices = await prisma.invoice.findMany({
      where: { projectId: project.projectId }
    });

    const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const receivedAmount = projectInvoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pendingRecovery = totalInvoiced - receivedAmount;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        invoicedAmount: totalInvoiced,
        receivedAmount: receivedAmount,
        pendingRecovery: pendingRecovery
      }
    });

    console.log(`📊 Updated ${project.name}: Invoiced $${totalInvoiced.toLocaleString()}, Received $${receivedAmount.toLocaleString()}, Pending $${pendingRecovery.toLocaleString()}`);
  }

  console.log('✅ Invoice generation completed!');
}

generateInvoices()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
