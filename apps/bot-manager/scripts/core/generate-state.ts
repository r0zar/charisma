#!/usr/bin/env node

/**
 * Main App State Generator
 * Generates a complete JSON state file for the bot-manager application
 * Usage: node --import tsx scripts/generate-state.ts [options]
 */

import { syncLogger as logger } from '../utils/logger';
import { AppState, GeneratorOptions, GeneratorMetadata } from '@/schemas/app-state.schema';
import { SeededRandom, getProfileConfig } from '../data/generators/helpers';
import { generateBots, generateBotStats } from '../data/generators/bot-generator';
import { generateUserSettings, generateUIPreferences, generateWalletState, generateNotifications } from '../data/generators/user-generator';
import { AppStateSchema } from '@/schemas/app-state.schema';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const fs = require('fs');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            // Remove quotes if present
            const cleanValue = value.replace(/^["']|["']$/g, '');
            process.env[key.trim()] = cleanValue;
          }
        }
      }
      console.log(`ℹ️  Loaded environment variables from ${envPath}`);
    } else {
      console.warn(`⚠️  Environment file not found: ${envPath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to load environment file: ${error}`);
  }
}

// Load environment variables before doing anything else
loadEnvFile();

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
    targetWalletAddress: undefined,
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
      case '--wallet-address':
        options.targetWalletAddress = args[++i];
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
  --output <path>      Output file path (default: src/data/app-state.ts)
  --wallet-address <addr>  Assign all bots to specific wallet address
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
  node --import tsx scripts/generate-state.ts --wallet-address SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS

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

function validateEnvironment(options: GeneratorOptions): string[] {
  const errors: string[] = [];

  // Check for wallet encryption key if not using testing profile
  if (options.profile !== 'testing' && !process.env.WALLET_ENCRYPTION_KEY) {
    errors.push('WALLET_ENCRYPTION_KEY environment variable is required for non-testing profiles');
    errors.push('Add WALLET_ENCRYPTION_KEY=<your-encryption-key> to your .env.local file');
  }

  return errors;
}

async function generateAppState(options: GeneratorOptions): Promise<AppState> {
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
  
  if (finalOptions.targetWalletAddress) {
    console.log(`👤 Target wallet: ${finalOptions.targetWalletAddress} (all bots will belong to this wallet)`);
  } else {
    console.log(`🎲 Random wallets: each bot will have its own wallet address`);
  }
  
  if (options.profile !== 'testing') {
    console.log(`🔐 Wallet encryption: enabled (real wallets)`);
  } else {
    console.log(`📝 Wallet encryption: disabled (mock wallets for testing)`);
  }

  // Generate metadata
  const metadata = {
    environment: 'development' as const,
    loadingConfig: 'static',
    apiBaseUrl: 'http://localhost:3420/api/v1',
    apiTimeout: 30000,
    cacheEnabled: true,
    cacheTtl: 300000,
    debugDataLoading: false,
    logDataSources: false,
    featureFlags: {
      enableApiMetadata: false,
      enableApiUser: false,
      enableApiBots: false,
      enableApiMarket: false,
      enableApiNotifications: false,
    },
    isServer: false,
    isClient: false,
    timestamp: new Date().toISOString(),
  };

  // Generate user data
  console.log('👤 Generating user data...');
  const userSettings = generateUserSettings(rng, finalOptions);
  const userPreferences = generateUIPreferences(rng, finalOptions);
  const walletState = generateWalletState(rng, finalOptions);

  // Generate bot data (now async)
  console.log('🤖 Generating bot data...');
  const bots = await generateBots(rng, finalOptions);
  const botStats = generateBotStats(bots);

  // Market data removed - no longer generating market data

  // Generate notifications
  console.log('🔔 Generating notifications...');
  const notifications = generateNotifications(rng, finalOptions);

  // Create minimal empty analytics (real data will be populated by analytics system)
  const emptyAnalytics = {
    totalValue: 0,
    totalPnL: 0,
    activeBots: bots.filter(bot => bot.status === 'active').length,
    successRate: 0,
    volumeToday: 0,
    bestPerformer: bots.length > 0 ? bots[0].name : 'N/A',
    worstPerformer: bots.length > 0 ? bots[0].name : 'N/A',
    avgGasUsed: 0,
    totalTransactions: 0,
    profitableDays: 0,
    totalDays: 0,
    timeRange: '7d' as const,
    chartData: []
  };

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
      activities: [], // Empty - real activities will be populated by analytics system
    },
    // Market section removed
    notifications,
  };

  return appState;
}

async function saveAppState(appState: AppState, outputPath: string): Promise<void> {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Determine if we're generating a TypeScript file or JSON
  const isTypeScript = outputPath.endsWith('.ts');
  
  if (isTypeScript) {
    // Generate TypeScript file with proper imports and type annotations
    const tsContent = `import { type AppState } from '@/schemas/app-state.schema';

/**
 * Generated application state data
 * Created with proper TypeScript types for compile-time safety
 */
export const appState: AppState = ${JSON.stringify(appState, null, 2)} as const;
`;
    await fs.writeFile(outputPath, tsContent, 'utf8');
  } else {
    // Write formatted JSON (for compatibility)
    const jsonData = JSON.stringify(appState, null, 2);
    await fs.writeFile(outputPath, jsonData, 'utf8');
  }
}

function printStatistics(appState: AppState, outputPath: string): void {
  const stats = {
    fileSize: JSON.stringify(appState).length,
    bots: appState.bots.list.length,
    activities: appState.bots.activities.length,
    // pools: removed,
    notifications: appState.notifications.length,
    walletTransactions: appState.user.wallet.transactions.length,
    tokens: appState.user.wallet.balance.tokens.length,
  };

  console.log('\n📊 Generation Statistics:');
  console.log(`📁 Output file: ${outputPath}`);
  console.log(`📏 File size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
  console.log(`🤖 Bots: ${stats.bots}`);
  console.log(`⚡ Activities: ${stats.activities}`);
  // console.log(`🏊 DeFi pools: ${stats.pools}`); // removed
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
    
    logger.info('Starting app state generation', {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    });

    // Parse and validate options
    const options = parseArgs();
    logger.info('Parsed generation options', {
      profile: options.profile,
      seed: options.seed,
      botCount: options.botCount,
      daysOfHistory: options.daysOfHistory,
      outputPath: options.outputPath,
      targetWallet: options.targetWalletAddress ? `${options.targetWalletAddress.slice(0, 8)}...` : null,
      realisticData: options.realisticData
    });
    
    const validationErrors = validateOptions(options);
    
    if (validationErrors.length > 0) {
      logger.error('Options validation failed', {
        errors: validationErrors,
        providedOptions: options
      });
      throw new Error(`Invalid options: ${validationErrors.join(', ')}`);
    }

    // Validate environment
    const environmentErrors = validateEnvironment(options);
    if (environmentErrors.length > 0) {
      console.log('\n❌ Environment validation failed:');
      environmentErrors.forEach(error => console.log(`   ${error}`));
      throw new Error(`Environment validation failed: ${environmentErrors.join(', ')}`);
    }

    // Set default output path
    if (!options.outputPath) {
      options.outputPath = path.join(process.cwd(), 'src', 'data', 'app-state.ts');
    }

    // Generate app state
    console.log('\n🎯 Starting app state generation...');
    const appState = await generateAppState(options);

    // Validate generated state
    console.log('\n✅ Validating generated state...');
    const validation = AppStateSchema.safeParse(appState);
    
    if (!validation.success) {
      const validationErrors = validation.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      );
      logger.error(`Validation failed: ${validationErrors.join(', ')}`);
      console.log('❌ Validation errors:');
      validationErrors.forEach(error => console.log(`   ${error}`));
      throw new Error(`Generated state is invalid: ${validationErrors.join(', ')}`);
    }

    logger.info('✅ Validation successful');
    console.log('✅ Generated state is valid!');

    // Save to file
    console.log('\n💾 Saving app state...');
    await saveAppState(appState, options.outputPath);

    // Print statistics
    printStatistics(appState, options.outputPath);

    const duration = Date.now() - startTime;
    logger.success(`✅ App state generation completed (${duration}ms)`);

    console.log('\n✅ App state generated successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📁 Output: ${options.outputPath}`);
    
  } catch (error) {
    logger.error(`App state generation failed: ${error instanceof Error ? error.message : String(error)}`);
    
    console.log('\n❌ App state generation failed!');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  logger.error(`App state generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});