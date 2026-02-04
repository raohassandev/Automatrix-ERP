#!/usr/bin/env node
/**
 * Seed categories based on imported data analysis
 * Run with: node scripts/seed-categories.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  // Expense Categories (from XLSX transactions + common C&I)
  { name: 'Material (Stock/Inventory)', type: 'expense', description: 'Materials purchased for stock/warehouse' },
  { name: 'Material (Project Direct)', type: 'expense', description: 'Materials purchased directly for specific projects' },
  { name: 'Marketing', type: 'expense', description: 'Marketing and sales expenses' },
  { name: 'Food', type: 'expense', description: 'Meals and daily allowance' },
  { name: 'Fuel', type: 'expense', description: 'Fuel and transportation' },
  { name: 'Vehicle Maintenance', type: 'expense', description: 'Vehicle repairs and maintenance' },
  { name: 'Owner Draw / Personal', type: 'expense', description: 'Owner personal expenses (not company cost)' },
  { name: 'Tools & Equipment', type: 'expense', description: 'Small tools and equipment purchases' },
  { name: 'Lodging & Travel', type: 'expense', description: 'Hotel, travel allowance, and travel costs' },
  { name: 'Subcontractor / Labor', type: 'expense', description: 'Outsourced work and labor payments' },
  { name: 'Office & Admin', type: 'expense', description: 'Office supplies, printing, admin costs' },
  { name: 'Utilities', type: 'expense', description: 'Electricity, water, internet, phone' },
  { name: 'Communications', type: 'expense', description: 'SIMs, data, internet, mobile charges' },
  { name: 'Freight / Logistics', type: 'expense', description: 'Shipping, courier, transport of materials' },
  { name: 'Permits / Compliance', type: 'expense', description: 'Permits, compliance, regulatory fees' },
  { name: 'Professional Services', type: 'expense', description: 'Legal, consulting, and professional fees' },

  // Inventory Categories (from XLSX + common C&I)
  { name: 'Cables', type: 'inventory', description: 'Electrical cables and accessories' },
  { name: 'General', type: 'inventory', description: 'General stock items' },
  { name: 'PLC / HMI', type: 'inventory', description: 'PLC, HMI, and automation controllers' },
  { name: 'Sensors & Instrumentation', type: 'inventory', description: 'Sensors, meters, instrumentation' },
  { name: 'Panels / Enclosures', type: 'inventory', description: 'Panels, enclosures, control boxes' },
  { name: 'Power Supplies', type: 'inventory', description: 'Power supplies and converters' },
  { name: 'Breakers & Switchgear', type: 'inventory', description: 'Breakers, contactors, switchgear' },
  { name: 'Conduits / Trays / Ducts', type: 'inventory', description: 'Conduits, trays, ducting materials' },
  { name: 'Fasteners & Accessories', type: 'inventory', description: 'Bolts, screws, brackets, misc accessories' },
  { name: 'Safety / PPE', type: 'inventory', description: 'Safety gear and protective equipment' },
  { name: 'Tools', type: 'inventory', description: 'Hand tools and equipment' },

  // Income Categories (milestones + service)
  { name: 'Advance / Mobilization', type: 'income', description: 'Advance or mobilization payment' },
  { name: 'Material Delivery', type: 'income', description: 'Payment on material delivery milestone' },
  { name: 'Installation / Commissioning', type: 'income', description: 'Commissioning or installation milestone' },
  { name: 'Final Payment', type: 'income', description: 'Final project payment' },
  { name: 'Retention Released', type: 'income', description: 'Retention release payment' },
  { name: 'Variation / Change Order', type: 'income', description: 'Variation or change order payment' },
  { name: 'Service / Maintenance', type: 'income', description: 'Service and maintenance revenue' },
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
