// Bot Data Generator
import { Bot, BotStats, LpTokenBalance, RewardTokenBalance } from '@/schemas/bot.schema';
import { GeneratorOptions } from '@/schemas/app-state.schema';
import { getStrategyTemplates } from '@/lib/services/bots/strategy-parser';
import { createBotImageConfig } from '@/lib/services/bots/images';
import { syncLogger as logger } from '../../utils/logger';
// Note: wallet-encryption import moved to conditional usage to avoid env var requirement
import {
  SeededRandom,
  BOT_NAMES,
  TOKEN_NAMES,
  BOT_STATUSES,
  generateStacksAddress,
  generateContractId,
  generateDate,
  generateAmount,
  generateSuccessRate,
  generatePnL,
  createId,
  getProfileConfig,
} from './helpers';

export async function generateBots(rng: SeededRandom, options: GeneratorOptions): Promise<Bot[]> {
  const startTime = Date.now();
  const config = getProfileConfig(options.profile);
  const botCount = options.botCount || config.botCount;
  const bots: Bot[] = [];

  logger.info('Starting bot generation', {
    profile: options.profile,
    botCount,
    targetWallet: options.targetWalletAddress ? `${options.targetWalletAddress.slice(0, 8)}...` : null,
    config: {
      daysOfHistory: config.daysOfHistory,
      includeErrors: config.includeErrors,
      realisticData: config.realisticData
    }
  });

  if (options.targetWalletAddress) {
    console.log(`🔐 Generating ${botCount} bots for target wallet: ${options.targetWalletAddress.slice(0, 8)}...`);
  } else {
    console.log(`🔐 Generating ${botCount} bots with individual wallets...`);
  }

  for (let i = 0; i < botCount; i++) {
    try {
      const botStartTime = Date.now();
      const bot = await generateBot(rng, options, i);
      bots.push(bot);
      const botDuration = Date.now() - botStartTime;

      logger.debug('Bot generated successfully', {
        index: i + 1,
        total: botCount,
        botName: bot.name,
        ownerId: bot.ownerId,
        status: bot.status,
        strategy: bot.strategy.substring(0, 50) + '...',
        duration: `${botDuration}ms`
      });

      console.log(`✓ Generated bot ${i + 1}/${botCount}: ${bot.name} (${bot.id})`);
    } catch (error) {
      logger.error('Bot generation failed', {
        index: i + 1,
        total: botCount,
        error: error instanceof Error ? error.message : String(error),
        options: {
          profile: options.profile,
          targetWallet: options.targetWalletAddress
        }
      });
      console.error(`❌ Failed to generate bot ${i + 1}/${botCount}:`, error);
      throw error; // Fail fast on wallet generation errors
    }
  }

  const totalDuration = Date.now() - startTime;
  logger.success('Bot generation completed', {
    totalBots: bots.length,
    profile: options.profile,
    duration: `${totalDuration}ms`,
    averagePerBot: `${Math.round(totalDuration / bots.length)}ms`,
    statusBreakdown: bots.reduce((acc, bot) => {
      acc[bot.status] = (acc[bot.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  console.log(`🎉 Successfully generated ${bots.length} bots with real wallets`);
  return bots;
}

async function generateBot(rng: SeededRandom, options: GeneratorOptions, index: number): Promise<Bot> {
  const config = getProfileConfig(options.profile);
  const daysActive = rng.nextInt(1, config.daysOfHistory);

  // Get strategy templates and randomly select one
  const strategyTemplates = getStrategyTemplates();
  const templateKeys = Object.keys(strategyTemplates);
  const selectedTemplate = rng.choice(templateKeys);
  const strategy = strategyTemplates[selectedTemplate as keyof typeof strategyTemplates].code;

  // Set bot status based on profile
  let status: typeof BOT_STATUSES[number];
  if (options.profile === 'development') {
    // Development bots start as setup (unfunded, need configuration)
    status = 'setup';
  } else if (options.profile === 'testing') {
    // Testing can have varied statuses for UI testing
    status = rng.choice(BOT_STATUSES);
  } else {
    // Production/demo profiles use realistic distribution
    const statusWeights = {
      'active': 0.4,    // 40% active
      'paused': 0.3,    // 30% paused  
      'setup': 0.2,     // 20% in setup
      'error': 0.05,    // 5% error
      'inactive': 0.05  // 5% inactive
    };
    status = rng.weightedChoice(Object.keys(statusWeights) as any[], Object.values(statusWeights));
  }

  // Generate P&L based on strategy type and time
  const pnl = generatePnL(rng, selectedTemplate, daysActive, options.profile);

  const botName = rng.choice(BOT_NAMES);

  // Generate or use target wallet address (this will be the bot's ID)
  let botWalletAddress: string;
  let encryptedWallet: string | undefined;
  let walletIv: string | undefined;
  let publicKey: string | undefined;

  if (options.profile === 'testing') {
    // Use mock wallet for testing profile
    botWalletAddress = generateStacksAddress(rng, true);
    console.log(`  📝 Using mock wallet for testing profile: ${botWalletAddress}`);
  } else {
    // Generate real wallet with encryption
    try {
      // Dynamic import to avoid env var requirement when not needed
      const { generateBotWallet, encryptWalletCredentials } = await import('../../../src/lib/infrastructure/security/wallet-encryption');

      const walletCredentials = await generateBotWallet();
      const encrypted = encryptWalletCredentials(walletCredentials);

      botWalletAddress = walletCredentials.walletAddress;
      encryptedWallet = encrypted.encryptedPrivateKey;
      walletIv = encrypted.privateKeyIv;
      publicKey = walletCredentials.publicKey;
    } catch (error) {
      console.error(`Failed to generate wallet for bot ${botName}:`, error);
      throw new Error(`Wallet generation failed for bot ${botName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate image configuration for the bot using the wallet address as ID
  const imageConfig = createBotImageConfig(botName, botWalletAddress, 'pokemon');

  // Owner is either the target wallet or the bot's own wallet (for self-owned bots)
  const ownerId = options.targetWalletAddress || botWalletAddress;

  const bot: Bot = {
    id: botWalletAddress, // Bot ID is now the wallet address
    name: botName,
    strategy,
    status,
    ownerId, // Owner's STX address
    createdAt: generateDate(rng, config.daysOfHistory),
    lastActive: generateDate(rng, 1),

    // Encrypted wallet data (only for non-testing profiles)
    encryptedWallet,
    walletIv,
    publicKey, // Public key (safe to display)

    // Bot visual identity
    image: imageConfig.image,
    imageType: imageConfig.imageType,

    // Scheduling configuration (default to disabled)
    isScheduled: false,
    cronSchedule: undefined,
    lastExecution: undefined,
    nextExecution: undefined,
    executionCount: 0
  };

  return bot;
}




export function generateBotStats(bots: Bot[]): BotStats {
  const totalBots = bots.length;
  const activeBots = bots.filter(bot => bot.status === 'active').length;
  const pausedBots = bots.filter(bot => bot.status === 'paused').length;
  const errorBots = bots.filter(bot => bot.status === 'error').length;

  return {
    totalBots,
    activeBots,
    pausedBots,
    errorBots,
  };
}

// All exports are already defined above with export keyword