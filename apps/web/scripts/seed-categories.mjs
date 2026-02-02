#!/usr/bin/env node
/**
 * Seed categories based on imported data analysis
 * Run with: node scripts/seed-categories.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  // Expense Categories (from imported transactions)
  { name: 'Material (Stock/Inventory)', type: 'expense', description: 'Materials purchased for stock/warehouse' },
  { name: 'Material (Project Direct)', type: 'expense', description: 'Materials purchased directly for specific projects' },
  { name: 'Marketing', type: 'expense', description: 'Marketing and advertising expenses' },
  { name: 'Food', type: 'expense', description: 'Employee meals and food expenses' },
  { name: 'Fuel', type: 'expense', description: 'Vehicle fuel and transportation' },
  { name: 'Vehicle Maintenance', type: 'expense', description: 'Vehicle repairs and maintenance' },
  { name: 'Office Supplies', type: 'expense', description: 'General office supplies and equipment' },
  { name: 'Utilities', type: 'expense', description: 'Electricity, water, internet, phone bills' },
  { name: 'Travel', type: 'expense', description: 'Business travel and accommodation' },
  { name: 'Professional Services', type: 'expense', description: 'Legal, consulting, and professional fees' },

  // Inventory Categories (from imported inventory)
  { name: 'Electrical Cables', type: 'inventory', description: 'Single and multi-core electrical cables' },
  { name: 'Fiber Optic', type: 'inventory', description: 'Fiber optic cables and accessories' },
  { name: 'General Electrical', type: 'inventory', description: 'General electrical materials and components' },
  { name: 'Solar Equipment', type: 'inventory', description: 'Solar panels, inverters, and related equipment' },
  { name: 'Tools & Equipment', type: 'inventory', description: 'Construction and electrical tools' },
  { name: 'Safety Equipment', type: 'inventory', description: 'Safety gear and protective equipment' },
  { name: 'Hardware', type: 'inventory', description: 'Bolts, screws, brackets, and hardware' },

  // Income Categories (from imported income)
  { name: 'Project Revenue', type: 'income', description: 'Revenue from completed projects' },
  { name: 'Milestone Payments', type: 'income', description: 'Partial payments for project milestones' },
  { name: 'Maintenance Revenue', type: 'income', description: 'Revenue from maintenance services' },
  { name: 'Consulting Revenue', type: 'income', description: 'Revenue from consulting services' },
  { name: 'Equipment Sales', type: 'income', description: 'Revenue from equipment sales' },
];

async function seedCategories() {
  console.log('🌱 Starting category seeding...\n');
  
  let created = 0;
  let skipped = 0;

  for (const categoryData of categories) {
    try {
      const existing = await prisma.category.findUnique({
        where: { name: categoryData.name }
      });

      if (existing) {
        console.log(`⏭️  Skipping existing category: ${categoryData.name}`);
        skipped++;
        continue;
      }

      const category = await prisma.category.create({
        data: categoryData
      });

      console.log(`✅ Created ${category.type} category: ${category.name}`);
      created++;
    } catch (error) {
      console.error(`❌ Error creating category ${categoryData.name}:`, error.message);
    }
  }

  console.log(`\n📊 Seeding Summary:`);
  console.log(`   Categories created: ${created}`);
  console.log(`   Categories skipped: ${skipped}`);
  console.log(`   Total categories: ${created + skipped}\n`);

  // Show breakdown by type
  const counts = await prisma.category.groupBy({
    by: ['type'],
    _count: {
      type: true
    }
  });

  console.log(`📈 Category breakdown by type:`);
  for (const count of counts) {
    console.log(`   ${count.type}: ${count._count.type} categories`);
  }

  await prisma.$disconnect();
}

seedCategories().catch(console.error);