#!/usr/bin/env node

/**
 * State Validation Script
 * Validates an existing app state JSON file
 * Usage: node --import tsx scripts/validate-state.ts [path]
 */

import { logger, logExecution, logResult, logError } from './logger';
import { validateStateFile } from '@/lib/state-loader';
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
    
    await logExecution('Starting state validation', `Validating ${filePath}`);

    console.log(`\n🔍 Validating state file: ${filePath}`);

    // Validate the state file
    const validation = await validateStateFile(filePath);

    // Print results
    console.log('\n📊 Validation Results:');
    console.log(`✅ Valid: ${validation.isValid}`);
    console.log(`❌ Errors: ${validation.errors.length}`);
    console.log(`⚠️  Warnings: ${validation.warnings.length}`);

    // Print metadata
    console.log('\n📋 File Metadata:');
    console.log(`📦 Version: ${validation.metadata.version}`);
    console.log(`🤖 Bot count: ${validation.metadata.botCount}`);
    console.log(`⚡ Total activities: ${validation.metadata.totalActivities}`);
    console.log(`📏 Data size: ${(validation.metadata.dataSize / 1024).toFixed(2)} KB`);

    // Print errors if any
    if (validation.errors.length > 0) {
      console.log('\n❌ Validation Errors:');
      validation.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Print warnings if any
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      validation.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    const duration = Date.now() - startTime;
    await logResult('State validation', { 
      exitCode: validation.isValid ? 0 : 1,
      stdout: validation.isValid ? 'Valid' : 'Invalid'
    }, duration);

    if (validation.isValid) {
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
    await logError('State validation failed', error instanceof Error ? error : new Error(String(error)));
    
    console.log('\n❌ State validation failed!');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('State validation failed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});