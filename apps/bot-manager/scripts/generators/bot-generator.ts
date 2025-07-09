// Bot Data Generator
import { Bot, BotStats, BotActivity, LpTokenBalance, RewardTokenBalance } from '@/types/bot';
import { GeneratorOptions } from '@/types/app-state';
import {
  SeededRandom,
  BOT_NAMES,
  TOKEN_NAMES,
  STRATEGIES,
  BOT_STATUSES,
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
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

export function generateBots(rng: SeededRandom, options: GeneratorOptions): Bot[] {
  const config = getProfileConfig(options.profile);
  const botCount = options.botCount || config.botCount;
  const bots: Bot[] = [];
  
  for (let i = 0; i < botCount; i++) {
    const bot = generateBot(rng, options, i);
    bots.push(bot);
  }
  
  return bots;
}

function generateBot(rng: SeededRandom, options: GeneratorOptions, index: number): Bot {
  const config = getProfileConfig(options.profile);
  const daysActive = rng.nextInt(1, config.daysOfHistory);
  const strategy = rng.choice(STRATEGIES);
  const status = rng.choice(BOT_STATUSES);
  
  // Generate P&L based on strategy and time
  const pnl = generatePnL(rng, strategy, daysActive, options.profile);
  
  // Generate balances
  const lpTokenBalances = generateLpTokenBalances(rng, options.profile);
  const rewardTokenBalances = generateRewardTokenBalances(rng, options.profile);
  
  // Generate setup progress
  const setupProgress = generateSetupProgress(rng, status);
  
  const bot: Bot = {
    id: createId('bot', rng),
    name: rng.choice(BOT_NAMES),
    strategy,
    status,
    walletAddress: generateStacksAddress(rng, options.profile === 'testing'),
    createdAt: generateDate(rng, config.daysOfHistory),
    lastActive: generateDate(rng, 1),
    dailyPnL: pnl.daily,
    totalPnL: pnl.total,
    totalVolume: generateAmount(rng, options.profile, 'large'),
    successRate: generateSuccessRate(rng, strategy),
    maxGasPrice: generateGasPrice(rng),
    slippageTolerance: generateSlippage(rng),
    autoRestart: rng.nextBoolean(0.7),
    stxBalance: generateAmount(rng, options.profile, 'medium'),
    lpTokenBalances,
    rewardTokenBalances,
    setupProgress,
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

function generateSetupProgress(rng: SeededRandom, status: string): {
  funded: boolean;
  lpTokensAdded: boolean;
  activated: boolean;
  completionPercentage: number;
} {
  if (status === 'setup') {
    const funded = rng.nextBoolean(0.8);
    const lpTokensAdded = funded ? rng.nextBoolean(0.7) : false;
    const activated = lpTokensAdded ? rng.nextBoolean(0.6) : false;
    
    const completionPercentage = 
      (funded ? 33 : 0) +
      (lpTokensAdded ? 33 : 0) +
      (activated ? 34 : 0);
    
    return {
      funded,
      lpTokensAdded,
      activated,
      completionPercentage,
    };
  }
  
  // For non-setup bots, assume they're fully set up
  return {
    funded: true,
    lpTokensAdded: true,
    activated: true,
    completionPercentage: 100,
  };
}

export function generateBotActivities(rng: SeededRandom, bots: Bot[], options: GeneratorOptions): BotActivity[] {
  const activities: BotActivity[] = [];
  const config = getProfileConfig(options.profile);
  
  for (const bot of bots) {
    const activityCount = rng.nextInt(5, 20);
    
    for (let i = 0; i < activityCount; i++) {
      const activity = generateBotActivity(rng, bot, options, config);
      activities.push(activity);
    }
  }
  
  // Sort by timestamp (newest first)
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateBotActivity(rng: SeededRandom, bot: Bot, options: GeneratorOptions, config: any): BotActivity {
  const type = rng.choice(ACTIVITY_TYPES);
  const status = rng.choice(ACTIVITY_STATUSES);
  const timestamp = generateDate(rng, config.daysOfHistory);
  
  // Generate activity description based on type
  const descriptions = {
    'yield-farming': [
      'Staked tokens in liquidity pool',
      'Harvested yield rewards',
      'Reinvested farming rewards',
      'Optimized pool allocation',
    ],
    'deposit': [
      'Deposited STX to bot wallet',
      'Added LP tokens to strategy',
      'Funded bot with rewards',
      'Increased position size',
    ],
    'withdrawal': [
      'Withdrew STX from bot',
      'Removed LP tokens',
      'Claimed reward tokens',
      'Reduced position size',
    ],
    'trade': [
      'Executed swap transaction',
      'Arbitrage opportunity captured',
      'Rebalanced portfolio',
      'Market making trade',
    ],
    'error': [
      'Transaction failed due to slippage',
      'Insufficient gas for transaction',
      'Contract call reverted',
      'Network connection timeout',
    ],
  };
  
  const activity: BotActivity = {
    id: createId('activity', rng),
    botId: bot.id,
    timestamp,
    type,
    status,
    description: rng.choice(descriptions[type]),
    blockHeight: rng.nextInt(100000, 999999),
    blockTime: timestamp,
  };
  
  // Add optional fields based on type
  if (type !== 'error') {
    activity.txid = generateTxHash(rng);
    activity.amount = generateAmount(rng, options.profile, 'small');
    activity.token = rng.choice(TOKEN_NAMES).symbol;
  }
  
  if (status === 'failed') {
    activity.error = rng.choice([
      'Slippage tolerance exceeded',
      'Insufficient balance',
      'Contract execution failed',
      'Network timeout',
    ]);
  }
  
  return activity;
}

export function generateBotStats(bots: Bot[]): BotStats {
  const totalBots = bots.length;
  const activeBots = bots.filter(bot => bot.status === 'active').length;
  const pausedBots = bots.filter(bot => bot.status === 'paused').length;
  const errorBots = bots.filter(bot => bot.status === 'error').length;
  
  const totalGas = bots.reduce((sum, bot) => sum + bot.maxGasPrice, 0);
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