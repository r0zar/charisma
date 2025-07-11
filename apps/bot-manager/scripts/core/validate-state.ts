#!/usr/bin/env node

/**
 * State Validation Script
 * Validates an existing app state JSON file
 * Usage: node --import tsx scripts/validate-state.ts [path]
 */

import { syncLogger as logger } from '../utils/logger';
import { validateStateFile } from '@/lib/data-loader.server';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const filePath = args[0] || 'public/data/app-state.json';

function showHelp() {
  console.log(`
✅ State Validation Script
=========================

Validates an existing app state JSON file against the schema.

Usage:
  node --import tsx scripts/validate-state.ts [path]

Arguments:
  path                 Path to the state file (default: public/data/app-state.json)

Options:
  --help, -h           Show this help message

Examples:
  node --import tsx scripts/validate-state.ts
  node --import tsx scripts/validate-state.ts public/data/demo-state.json
  node --import tsx scripts/validate-state.ts --help

Output:
  - Validation results (errors and warnings)
  - File metadata and statistics
  - Recommendations for fixing issues
`);
}

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

async function main() {
  try {
    const startTime = Date.now();
    
    logger.info(`🚀 Starting state validation: Validating ${filePath}`);

    console.log(`\n🔍 Validating state file: ${filePath}`);

    // Validate the state file
    const validation = await validateStateFile(filePath);

    // Print results
    console.log('\n📊 Validation Results:');
    console.log(`✅ Valid: ${validation.success}`);
    console.log(`❌ Errors: ${validation.validationErrors?.length || 0}`);
    console.log(`⚠️  Warnings: ${validation.warnings?.length || 0}`);

    // Print metadata
    console.log('\n📋 File Metadata:');
    console.log(`📦 Version: ${validation.metadata?.version || 'unknown'}`);
    console.log(`🤖 Bot count: ${validation.metadata?.botCount || 0}`);
    console.log(`⚡ Total activities: ${validation.metadata?.totalActivities || 0}`);
    console.log(`📏 Data size: ${((validation.metadata?.dataSize || 0) / 1024).toFixed(2)} KB`);

    // Print errors if any
    if (validation.validationErrors && validation.validationErrors.length > 0) {
      console.log('\n❌ Validation Errors:');
      validation.validationErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Print warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      validation.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    const duration = Date.now() - startTime;
    logger.success(`✅ State validation completed (${duration}ms)`);

    if (validation.success) {
      console.log('\n✅ State file is valid!');
      console.log(`⏱️  Duration: ${duration}ms`);
    } else {
      console.log('\n❌ State file is invalid!');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('\n💡 Recommendations:');
      console.log('   1. Check the error messages above');
      console.log('   2. Regenerate the state file with the correct parameters');
      console.log('   3. Use the generate-state.ts script to create a new valid state');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error(`State validation failed: ${error instanceof Error ? error.message : String(error)}`);
    
    console.log('\n❌ State validation failed!');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  logger.error(`State validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});