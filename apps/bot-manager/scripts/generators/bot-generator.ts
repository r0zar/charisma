// Bot Data Generator
import { Bot, BotStats, LpTokenBalance, RewardTokenBalance } from '@/schemas/bot.schema';
import { GeneratorOptions } from '@/schemas/app-state.schema';
import { getStrategyTemplates } from '@/lib/strategy-parser';
import { createBotImageConfig } from '@/lib/bot-images';
// Note: wallet-encryption import moved to conditional usage to avoid env var requirement
import {
  SeededRandom,
  BOT_NAMES,
  TOKEN_NAMES,
  BOT_STATUSES,
  generateStacksAddress,
  generateTxHash,
  generateContractId,
  generateDate,
  generateAmount,
  generateSuccessRate,
  generatePnL,
  generateGasPrice,
  generateSlippage,
  createId,
  getProfileConfig,
} from './helpers';

export async function generateBots(rng: SeededRandom, options: GeneratorOptions): Promise<Bot[]> {
  const config = getProfileConfig(options.profile);
  const botCount = options.botCount || config.botCount;
  const bots: Bot[] = [];
  
  if (options.targetWalletAddress) {
    console.log(`🔐 Generating ${botCount} bots for target wallet: ${options.targetWalletAddress.slice(0, 8)}...`);
  } else {
    console.log(`🔐 Generating ${botCount} bots with individual wallets...`);
  }
  
  for (let i = 0; i < botCount; i++) {
    try {
      const bot = await generateBot(rng, options, i);
      bots.push(bot);
      console.log(`✓ Generated bot ${i + 1}/${botCount}: ${bot.name} (${bot.walletAddress})`);
    } catch (error) {
      console.error(`❌ Failed to generate bot ${i + 1}/${botCount}:`, error);
      throw error; // Fail fast on wallet generation errors
    }
  }
  
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
  
  const status = rng.choice(BOT_STATUSES);
  
  // Generate P&L based on strategy type and time
  const pnl = generatePnL(rng, selectedTemplate, daysActive, options.profile);
  
  const botName = rng.choice(BOT_NAMES);
  const botId = createId('bot', rng);
  
  // Generate image configuration for the bot
  const imageConfig = createBotImageConfig(botName, botId, 'pokemon');
  
  // Generate or use target wallet address
  let walletAddress: string;
  let encryptedWallet: string | undefined;
  let walletIv: string | undefined;
  
  if (options.targetWalletAddress) {
    // Use the specified target wallet address
    walletAddress = options.targetWalletAddress;
    console.log(`  👤 Using target wallet address: ${walletAddress}`);
    
    // Note: For target wallet addresses, we don't store encrypted credentials
    // as we assume the user manages their own wallet
    encryptedWallet = undefined;
    walletIv = undefined;
  } else if (options.profile === 'testing') {
    // Use mock wallet for testing profile
    walletAddress = generateStacksAddress(rng, true);
    console.log(`  📝 Using mock wallet for testing profile: ${walletAddress}`);
  } else {
    // Generate real wallet with encryption
    try {
      // Dynamic import to avoid env var requirement when not needed
      const { generateBotWallet, encryptWalletCredentials } = await import('@/lib/wallet-encryption');
      
      const walletCredentials = await generateBotWallet();
      const encrypted = encryptWalletCredentials(walletCredentials);
      
      walletAddress = walletCredentials.walletAddress;
      encryptedWallet = encrypted.encryptedPrivateKey;
      walletIv = encrypted.privateKeyIv;
    } catch (error) {
      console.error(`Failed to generate wallet for bot ${botName}:`, error);
      throw new Error(`Wallet generation failed for bot ${botName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  const bot: Bot = {
    id: botId,
    name: botName,
    strategy,
    status,
    walletAddress,
    createdAt: generateDate(rng, config.daysOfHistory),
    lastActive: generateDate(rng, 1),
    
    // Encrypted wallet data (only for non-testing profiles)
    encryptedWallet,
    walletIv,
    
    // Bot visual identity
    image: imageConfig.image,
    imageType: imageConfig.imageType,
    
    // Performance metrics
    dailyPnL: pnl.daily,
    totalPnL: pnl.total,
    totalVolume: generateAmount(rng, options.profile, 'large'),
    successRate: generateSuccessRate(rng, selectedTemplate),
    
    // Scheduling configuration (default to disabled)
    isScheduled: false,
    cronSchedule: undefined,
    lastExecution: undefined,
    nextExecution: undefined,
    executionCount: 0,
    
    // Balances
    stxBalance: generateAmount(rng, options.profile, 'medium'),
    lpTokenBalances: generateLpTokenBalances(rng, options.profile),
    rewardTokenBalances: generateRewardTokenBalances(rng, options.profile),
    
    // Activity
    recentActivity: [], // Will be populated separately
  };
  
  return bot;
}

function generateLpTokenBalances(rng: SeededRandom, profile: string): LpTokenBalance[] {
  const count = rng.nextInt(0, 3);
  const balances: LpTokenBalance[] = [];
  
  for (let i = 0; i < count; i++) {
    const token = rng.choice(TOKEN_NAMES);
    const balance = generateAmount(rng, profile, 'medium');
    const formattedBalance = balance / Math.pow(10, token.decimals);
    
    balances.push({
      contractId: generateContractId(rng, `${token.symbol.toLowerCase()}-pool`),
      symbol: token.symbol,
      name: `${token.name} Pool`,
      balance: Math.floor(balance),
      formattedBalance: Math.round(formattedBalance * 100) / 100,
      decimals: token.decimals,
      usdValue: formattedBalance * rng.nextFloat(0.1, 10),
    });
  }
  
  return balances;
}

function generateRewardTokenBalances(rng: SeededRandom, profile: string): RewardTokenBalance[] {
  const count = rng.nextInt(0, 4);
  const balances: RewardTokenBalance[] = [];
  
  for (let i = 0; i < count; i++) {
    const token = rng.choice(TOKEN_NAMES);
    const balance = generateAmount(rng, profile, 'large');
    const formattedBalance = balance / Math.pow(10, token.decimals);
    
    balances.push({
      contractId: generateContractId(rng, token.symbol.toLowerCase()),
      symbol: token.symbol,
      name: token.name,
      balance: Math.floor(balance),
      formattedBalance: Math.round(formattedBalance * 100) / 100,
      decimals: token.decimals,
      usdValue: formattedBalance * rng.nextFloat(0.01, 5),
    });
  }
  
  return balances;
}



export function generateBotStats(bots: Bot[]): BotStats {
  const totalBots = bots.length;
  const activeBots = bots.filter(bot => bot.status === 'active').length;
  const pausedBots = bots.filter(bot => bot.status === 'paused').length;
  const errorBots = bots.filter(bot => bot.status === 'error').length;
  
  const totalGas = 0; // Gas is now handled in strategy code
  const totalValue = bots.reduce((sum, bot) => {
    const lpValue = bot.lpTokenBalances.reduce((lpSum, token) => lpSum + (token.usdValue || 0), 0);
    const rewardValue = bot.rewardTokenBalances.reduce((rewardSum, token) => rewardSum + (token.usdValue || 0), 0);
    return sum + bot.stxBalance + lpValue + rewardValue;
  }, 0);
  
  const totalPnL = bots.reduce((sum, bot) => sum + bot.totalPnL, 0);
  const todayPnL = bots.reduce((sum, bot) => sum + bot.dailyPnL, 0);
  
  return {
    totalBots,
    activeBots,
    pausedBots,
    errorBots,
    totalGas,
    totalValue: Math.round(totalValue * 100) / 100,
    totalPnL: Math.round(totalPnL * 100) / 100,
    todayPnL: Math.round(todayPnL * 100) / 100,
  };
}

// All exports are already defined above with export keyword