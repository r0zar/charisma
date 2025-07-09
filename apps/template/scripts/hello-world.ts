#!/usr/bin/env node

/**
 * Enhanced Hello World script demonstrating TypeScript scripting capabilities
 * Usage: node --import tsx scripts/hello-world.ts [--verbose]
 */

import { logger, logExecution, logResult, logError } from './logger.ts';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose') || args.includes('-v');
const showHelp = args.includes('--help') || args.includes('-h');

// Set verbosity
if (isVerbose) {
  process.env.LOG_LEVEL = 'debug';
}

// Show usage if requested
if (showHelp) {
  console.log(`
👋 Hello World Script (TypeScript)
==================================

Usage:
  node --import tsx scripts/hello-world.ts [options]

Options:
  --verbose, -v     Verbose output and debug logging
  --help, -h        Show this help message

Examples:
  node --import tsx scripts/hello-world.ts           # Basic hello world
  node --import tsx scripts/hello-world.ts --verbose # With debug logging

Output:
  - Console: Pretty-printed progress
  - Logs: Human-readable logs in logs/ directory
`);
  process.exit(0);
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Starting hello world script', 'Demonstrating TypeScript scripting');
    
    // Load environment variables if available
    const envFile = path.join(process.cwd(), '.env.local');
    try {
      const envExists = await fs.access(envFile).then(() => true).catch(() => false);
      if (envExists) {
        await logger.info('Found .env.local file');
        await logger.debug('Environment file loaded successfully');
      } else {
        await logger.info('No .env.local file found');
      }
    } catch (error) {
      await logger.warn('Could not check for .env.local file');
    }
    
    // Demo some basic operations
    await logger.info('Getting system information');
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      timestamp: new Date().toISOString()
    };
    
    await logger.debug('System info collected', systemInfo);
    
    // Main hello world output
    console.log();
    console.log('\x1b[32m🌟 Hello, World! 🌟\x1b[0m');
    console.log('\x1b[36mWelcome to the enhanced TypeScript template!\x1b[0m');
    console.log();
    
    if (isVerbose) {
      console.log('\x1b[90mSystem Information:\x1b[0m');
      console.log('\x1b[90m  Platform: ' + systemInfo.platform + '\x1b[0m');
      console.log('\x1b[90m  Node Version: ' + systemInfo.nodeVersion + '\x1b[0m');
      console.log('\x1b[90m  Working Directory: ' + systemInfo.workingDirectory + '\x1b[0m');
      console.log('\x1b[90m  Timestamp: ' + systemInfo.timestamp + '\x1b[0m');
      console.log();
    }
    
    const duration = Date.now() - startTime;
    
    await logResult('Hello world script', { exitCode: 0, stdout: 'Hello, World!' }, duration);
    await logger.success(`Script completed successfully in ${duration}ms`);
    
    console.log('\x1b[33m✨ Script completed successfully!\x1b[0m');
    console.log('\x1b[90m   Duration: ' + duration + 'ms\x1b[0m');
    console.log('\x1b[90m   Check logs/ directory for detailed execution logs\x1b[0m');
    
  } catch (error) {
    await logError('Script execution failed', error instanceof Error ? error : new Error(String(error)));
    
    console.log();
    console.log('\x1b[31m❌ Script failed!\x1b[0m');
    console.log('\x1b[31m   Error: ' + (error instanceof Error ? error.message : String(error)) + '\x1b[0m');
    
    if (isVerbose && error instanceof Error) {
      console.log('\x1b[90m   Stack trace:\x1b[0m');
      console.log('\x1b[90m' + error.stack + '\x1b[0m');
    }
    
    process.exit(1);
  }
  
  await logger.info('Hello world script completed');
}

// Execute main function
main().catch(async (error) => {
  await logError('Script execution failed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});