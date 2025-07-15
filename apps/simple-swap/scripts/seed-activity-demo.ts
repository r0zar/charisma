#!/usr/bin/env node

/**
 * Script to seed demo activity data for development
 */

import { seedDemoActivities } from '../src/lib/activity/demo-data';

async function main() {
  console.log('🌱 Seeding demo activity data...');
  
  try {
    await seedDemoActivities();
    console.log('✅ Demo data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
}

main().catch(console.error);