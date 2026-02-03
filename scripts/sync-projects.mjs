#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncProjects() {
  console.log('🔄 Syncing projects from expense data...');

  // Get expense project data with totals
  const expenseProjects = await prisma.expense.groupBy({
    by: ['project'],
    where: {
      project: {
        not: null
      }
    },
    _sum: {
      amount: true
    },
    _count: {
      _all: true
    }
  });

  console.log('📊 Found expense data for projects:', expenseProjects);

  // Create missing projects
  for (const expenseProject of expenseProjects) {
    if (!expenseProject.project) continue;

    // Check if project already exists
    const existingProject = await prisma.project.findFirst({
      where: { name: expenseProject.project }
    });

    if (!existingProject) {
      // Determine project details based on name
      let client = 'External Client';
      let contractValue = 0;
      
      if (expenseProject.project.includes('Office') || expenseProject.project.includes('Marketing') || expenseProject.project.includes('Home')) {
        client = 'Internal';
      }
      
      // Estimate contract value based on expense data (rough 30% margin assumption)
      const totalExpenses = Number(expenseProject._sum.amount) || 0;
      contractValue = Math.round(totalExpenses * 1.43); // Assume expenses are ~70% of contract value

      // Generate unique project ID
      const projectCount = await prisma.project.count();
      const projectId = `P-${String(projectCount + 104).padStart(3, '0')}`;

      const newProject = await prisma.project.create({
        data: {
          projectId,
          name: expenseProject.project,
          client,
          startDate: new Date('2024-01-01'), // Default start date
          endDate: null,
          status: totalExpenses > 100000 ? 'ACTIVE' : 'COMPLETED',
          contractValue,
          invoicedAmount: 0,
          receivedAmount: 0,
          pendingRecovery: 0,
          costToDate: totalExpenses,
          grossMargin: contractValue - totalExpenses,
          marginPercent: contractValue > 0 ? ((contractValue - totalExpenses) / contractValue) * 100 : 0,
        }
      });

      console.log(`✅ Created project: ${newProject.name} (${newProject.projectId}) - Contract: ${contractValue}, Costs: ${totalExpenses}`);
    } else {
      // Update existing project with current cost data
      const totalExpenses = Number(expenseProject._sum.amount) || 0;
      const updatedProject = await prisma.project.update({
        where: { id: existingProject.id },
        data: {
          costToDate: totalExpenses,
          grossMargin: Number(existingProject.contractValue) - totalExpenses,
          marginPercent: Number(existingProject.contractValue) > 0 ? 
            ((Number(existingProject.contractValue) - totalExpenses) / Number(existingProject.contractValue)) * 100 : 0,
        }
      });
      console.log(`🔄 Updated project: ${updatedProject.name} - Costs: ${totalExpenses}`);
    }
  }

  console.log('✅ Project sync completed!');
}

syncProjects()
  .catch(console.error)
  .finally(() => prisma.$disconnect());