#!/usr/bin/env node

/**
 * Main App State Generator
 * Generates a complete JSON state file for the bot-manager application
 * Usage: node --import tsx scripts/generate-state.ts [options]
 */

import { logger, logExecution, logResult, logError } from './logger';
import { AppState, GeneratorOptions, GeneratorMetadata } from '@/types/app-state';
import { SeededRandom, getProfileConfig } from './generators/helpers';
import { generateBots, generateBotActivities, generateBotStats } from './generators/bot-generator';
import { generateMarketData, generateDeFiPools, generateAnalyticsData } from './generators/market-generator';
import { generateUserSettings, generateUIPreferences, generateWalletState, generateNotifications } from './generators/user-generator';
import { validateAppState } from '@/lib/state-schema';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

function parseArgs(): GeneratorOptions {
  const options: GeneratorOptions = {
    profile: 'development',
    seed: Date.now(),
    botCount: undefined,
    daysOfHistory: undefined,
    includeErrors: undefined,
    realisticData: undefined,
    outputPath: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--profile':
        options.profile = args[++i] as any;
        break;
      case '--seed':
        options.seed = parseInt(args[++i]);
        break;
      case '--bots':
        options.botCount = parseInt(args[++i]);
        break;
      case '--days':
        options.daysOfHistory = parseInt(args[++i]);
        break;
      case '--errors':
        options.includeErrors = true;
        break;
      case '--no-errors':
        options.includeErrors = false;
        break;
      case '--realistic':
        options.realisticData = true;
        break;
      case '--output':
        options.outputPath = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🎲 App State Generator
======================

Generates a complete JSON state file for the bot-manager application.

Usage:
  node --import tsx scripts/generate-state.ts [options]

Options:
  --profile <name>     Data profile: development, demo, testing, production
  --seed <number>      Random seed for deterministic generation
  --bots <number>      Number of bots to generate
  --days <number>      Days of historical data to generate
  --errors             Include error scenarios in generated data
  --no-errors          Exclude error scenarios
  --realistic          Use realistic data values
  --output <path>      Output file path (default: public/data/app-state.json)
  --help, -h           Show this help message

Profiles:
  development          Small dataset for development (3 bots, 7 days)
  demo                 Impressive dataset for demonstrations (8 bots, 30 days)
  testing              Edge cases and error scenarios (5 bots, 14 days)
  production           Realistic production-like data (10 bots, 90 days)

Examples:
  node --import tsx scripts/generate-state.ts
  node --import tsx scripts/generate-state.ts --profile demo --seed 12345
  node --import tsx scripts/generate-state.ts --profile testing --bots 10
  node --import tsx scripts/generate-state.ts --output data/custom-state.json

Output:
  - JSON file with complete app state
  - Validation report
  - Generation statistics
`);
}

function validateOptions(options: GeneratorOptions): string[] {
  const errors: string[] = [];

  if (!['development', 'demo', 'testing', 'production'].includes(options.profile)) {
    errors.push(`Invalid profile: ${options.profile}`);
  }

  if (options.seed !== undefined && (options.seed < 0 || options.seed > Number.MAX_SAFE_INTEGER)) {
    errors.push(`Invalid seed: ${options.seed}`);
  }

  if (options.botCount !== undefined && (options.botCount < 1 || options.botCount > 100)) {
    errors.push(`Invalid bot count: ${options.botCount} (must be 1-100)`);
  }

  if (options.daysOfHistory !== undefined && (options.daysOfHistory < 1 || options.daysOfHistory > 365)) {
    errors.push(`Invalid days of history: ${options.daysOfHistory} (must be 1-365)`);
  }

  return errors;
}

function generateAppState(options: GeneratorOptions): AppState {
  const config = getProfileConfig(options.profile);
  const rng = new SeededRandom(options.seed || Date.now());

  // Use options or fall back to profile defaults
  const finalOptions: GeneratorOptions = {
    ...options,
    botCount: options.botCount || config.botCount,
    daysOfHistory: options.daysOfHistory || config.daysOfHistory,
    includeErrors: options.includeErrors !== undefined ? options.includeErrors : config.includeErrors,
    realisticData: options.realisticData !== undefined ? options.realisticData : config.realisticData,
  };

  console.log(`\n🎲 Generating app state with seed: ${options.seed}`);
  console.log(`📊 Profile: ${options.profile}`);
  console.log(`🤖 Bots: ${finalOptions.botCount}`);
  console.log(`📅 Days of history: ${finalOptions.daysOfHistory}`);
  console.log(`❌ Include errors: ${finalOptions.includeErrors}`);
  console.log(`🎯 Realistic data: ${finalOptions.realisticData}`);

  // Generate metadata
  const metadata: GeneratorMetadata = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    seed: options.seed,
    profile: options.profile,
    options: {
      botCount: finalOptions.botCount!,
      daysOfHistory: finalOptions.daysOfHistory!,
      includeErrors: finalOptions.includeErrors!,
      realisticData: finalOptions.realisticData!,
    },
  };

  // Generate user data
  console.log('👤 Generating user data...');
  const userSettings = generateUserSettings(rng, finalOptions);
  const userPreferences = generateUIPreferences(rng, finalOptions);
  const walletState = generateWalletState(rng, finalOptions);

  // Generate bot data
  console.log('🤖 Generating bot data...');
  const bots = generateBots(rng, finalOptions);
  const botActivities = generateBotActivities(rng, bots, finalOptions);
  const botStats = generateBotStats(bots);

  // Generate market data
  console.log('📈 Generating market data...');
  const marketData = generateMarketData(rng, finalOptions);
  const defiPools = generateDeFiPools(rng, finalOptions);
  const analyticsData = generateAnalyticsData(rng, finalOptions);

  // Generate notifications
  console.log('🔔 Generating notifications...');
  const notifications = generateNotifications(rng, finalOptions);

  // Assemble final state
  const appState: AppState = {
    metadata,
    user: {
      settings: userSettings,
      wallet: walletState,
      preferences: userPreferences,
    },
    bots: {
      list: bots,
      stats: botStats,
      activities: botActivities,
    },
    market: {
      data: marketData,
      analytics: analyticsData,
      pools: defiPools,
    },
    notifications,
  };

  return appState;
}

async function saveAppState(appState: AppState, outputPath: string): Promise<void> {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Write formatted JSON
  const jsonData = JSON.stringify(appState, null, 2);
  await fs.writeFile(outputPath, jsonData, 'utf8');
}

function printStatistics(appState: AppState, outputPath: string): void {
  const stats = {
    fileSize: JSON.stringify(appState).length,
    bots: appState.bots.list.length,
    activities: appState.bots.activities.length,
    pools: appState.market.pools.length,
    notifications: appState.notifications.length,
    walletTransactions: appState.user.wallet.transactions.length,
    tokens: appState.user.wallet.balance.tokens.length,
  };

  console.log('\n📊 Generation Statistics:');
  console.log(`📁 Output file: ${outputPath}`);
  console.log(`📏 File size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
  console.log(`🤖 Bots: ${stats.bots}`);
  console.log(`⚡ Activities: ${stats.activities}`);
  console.log(`🏊 DeFi pools: ${stats.pools}`);
  console.log(`🔔 Notifications: ${stats.notifications}`);
  console.log(`💰 Wallet transactions: ${stats.walletTransactions}`);
  console.log(`🪙 Token balances: ${stats.tokens}`);

  // Bot status breakdown
  const statusCounts = appState.bots.list.reduce((acc, bot) => {
    acc[bot.status] = (acc[bot.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n🤖 Bot Status Breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  // Strategy breakdown
  const strategyCounts = appState.bots.list.reduce((acc, bot) => {
    acc[bot.strategy] = (acc[bot.strategy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Strategy Breakdown:');
  Object.entries(strategyCounts).forEach(([strategy, count]) => {
    console.log(`   ${strategy}: ${count}`);
  });
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Starting app state generation', 'Generate complete JSON state file');

    // Parse and validate options
    const options = parseArgs();
    const validationErrors = validateOptions(options);
    
    if (validationErrors.length > 0) {
      throw new Error(`Invalid options: ${validationErrors.join(', ')}`);
    }

    // Set default output path
    if (!options.outputPath) {
      options.outputPath = path.join(process.cwd(), 'public', 'data', 'app-state.json');
    }

    // Generate app state
    console.log('\n🎯 Starting app state generation...');
    const appState = generateAppState(options);

    // Validate generated state
    console.log('\n✅ Validating generated state...');
    const validation = validateAppState(appState);
    
    if (!validation.isValid) {
      throw new Error(`Generated state is invalid: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Validation warnings:');
      validation.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    // Save to file
    console.log('\n💾 Saving app state...');
    await saveAppState(appState, options.outputPath);

    // Print statistics
    printStatistics(appState, options.outputPath);

    const duration = Date.now() - startTime;
    await logResult('App state generation', { exitCode: 0, stdout: 'Generated successfully' }, duration);

    console.log('\n✅ App state generated successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📁 Output: ${options.outputPath}`);
    
  } catch (error) {
    await logError('App state generation failed', error instanceof Error ? error : new Error(String(error)));
    
    console.log('\n❌ App state generation failed!');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('App state generation failed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});