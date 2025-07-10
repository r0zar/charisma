// Market Data Generator
import { MarketData, PerformanceMetrics, PnLDataPoint } from '@/schemas/bot.schema';
import { DeFiPool, AnalyticsData, GeneratorOptions } from '@/schemas/app-state.schema';
import {
  SeededRandom,
  TOKEN_NAMES,
  generateContractId,
  generateDate,
  generateAmount,
  generateAPR,
  generateTimeSeriesData,
  createId,
  getProfileConfig,
} from './helpers';

export function generateMarketData(rng: SeededRandom, options: GeneratorOptions): MarketData {
  const tokenPrices: Record<string, number> = {};
  const priceChanges: Record<string, number> = {};
  const marketCap: Record<string, number> = {};
  
  // Generate data for each token
  for (const token of TOKEN_NAMES) {
    const price = generateTokenPrice(rng, token.symbol, options.profile);
    const change = rng.nextFloat(-10, 10);
    const cap = generateAmount(rng, options.profile, 'large') * 1000;
    
    tokenPrices[token.symbol] = price;
    priceChanges[token.symbol] = change;
    marketCap[token.symbol] = cap;
  }
  
  return {
    tokenPrices,
    priceChanges,
    marketCap,
  };
}

function generateTokenPrice(rng: SeededRandom, symbol: string, profile: string): number {
  // Base prices for different tokens (in USD)
  const basePrices: Record<string, number> = {
    'STX': 0.5,
    'ALEX': 0.1,
    'DIKO': 0.05,
    'USDA': 1.0,
    'CHA': 0.01,
    'WELSH': 0.001,
    'PEPE': 0.0001,
    'LISA': 0.002,
    'ROOS': 0.003,
    'LEO': 0.008,
  };
  
  const basePrice = basePrices[symbol] || 0.01;
  const volatility = rng.nextFloat(0.7, 1.3);
  
  // Adjust based on profile
  const profileMultipliers = {
    development: 1,
    demo: 1.5, // Higher prices for demo
    testing: 0.5,
    production: 1,
  };
  
  const multiplier = profileMultipliers[profile as keyof typeof profileMultipliers] || 1;
  
  return Math.round(basePrice * volatility * multiplier * 10000) / 10000;
}

export function generateDeFiPools(rng: SeededRandom, options: GeneratorOptions): DeFiPool[] {
  const config = getProfileConfig(options.profile);
  const poolCount = rng.nextInt(5, 12);
  const pools: DeFiPool[] = [];
  
  const protocols = ['ALEX', 'Arkadiko', 'Velar', 'Bitflow', 'STX.city'];
  
  for (let i = 0; i < poolCount; i++) {
    const pool = generateDeFiPool(rng, options, protocols);
    pools.push(pool);
  }
  
  return pools;
}

function generateDeFiPool(rng: SeededRandom, options: GeneratorOptions, protocols: string[]): DeFiPool {
  const tokenA = rng.choice(TOKEN_NAMES);
  const tokenB = rng.choice(TOKEN_NAMES.filter(t => t !== tokenA));
  const protocol = rng.choice(protocols);
  
  const pool: DeFiPool = {
    id: createId('pool', rng),
    name: `${tokenA.symbol}-${tokenB.symbol}`,
    tokenA: tokenA.symbol,
    tokenB: tokenB.symbol,
    totalValueLocked: generateAmount(rng, options.profile, 'large') * 10,
    apr: generateAPR(rng, options.profile),
    volume24h: generateAmount(rng, options.profile, 'large'),
    fees24h: generateAmount(rng, options.profile, 'small'),
    liquidity: generateAmount(rng, options.profile, 'large') * 5,
  };
  
  return pool;
}

export function generateAnalyticsData(rng: SeededRandom, options: GeneratorOptions): AnalyticsData {
  const config = getProfileConfig(options.profile);
  
  // Generate chart data
  const chartData = [];
  const endDate = new Date();
  for (let i = 0; i < config.daysOfHistory; i++) {
    const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
    chartData.push({
      date: date.toISOString().split('T')[0],
      value: generateAmount(rng, options.profile, 'medium'),
      volume: generateAmount(rng, options.profile, 'large'),
    });
  }
  
  return {
    totalValue: generateAmount(rng, options.profile, 'large'),
    totalPnL: rng.nextFloat(-1000, 5000),
    activeBots: rng.nextInt(1, 10),
    successRate: rng.nextFloat(65, 85),
    volumeToday: generateAmount(rng, options.profile, 'large'),
    bestPerformer: `Bot ${rng.nextInt(1, 10)}`,
    worstPerformer: `Bot ${rng.nextInt(1, 10)}`,
    avgGasUsed: rng.nextFloat(1000, 5000),
    totalTransactions: rng.nextInt(100, 1000),
    profitableDays: rng.nextInt(1, config.daysOfHistory),
    totalDays: config.daysOfHistory,
    timeRange: '30d',
    chartData,
  };
}

function generatePerformanceMetrics(rng: SeededRandom, options: GeneratorOptions, config: any): PerformanceMetrics {
  const baseValue = generateAmount(rng, options.profile, 'medium');
  
  // Generate daily data
  const daily = generateTimeSeriesData(rng, Math.min(config.daysOfHistory, 30), baseValue)
    .map(point => ({
      date: point.date,
      pnl: point.value,
      volume: generateAmount(rng, options.profile, 'large'),
    }));
  
  // Generate weekly data
  const weekly = generateTimeSeriesData(rng, Math.min(Math.floor(config.daysOfHistory / 7), 12), baseValue * 7)
    .map(point => ({
      date: point.date,
      pnl: point.value,
      volume: generateAmount(rng, options.profile, 'large') * 7,
    }));
  
  // Generate monthly data
  const monthly = generateTimeSeriesData(rng, Math.min(Math.floor(config.daysOfHistory / 30), 6), baseValue * 30)
    .map(point => ({
      date: point.date,
      pnl: point.value,
      volume: generateAmount(rng, options.profile, 'large') * 30,
    }));
  
  return {
    daily,
    weekly,
    monthly,
  };
}

// All exports are already defined above with export keyword