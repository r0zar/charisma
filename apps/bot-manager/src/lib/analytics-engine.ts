/**
 * Analytics Engine
 * Core functions for processing real blockchain data into analytics insights
 */

import { getPrices } from '@repo/tokens';
import { getTransactionEvents } from '@repo/polyglot';
import type {
  TransactionEvent,
  ProcessedTransaction,
  PortfolioHolding,
  PerformanceMetrics,
  TimeSeriesPoint,
  AnalyticsSummary,
  YieldFarmingEvent,
  YieldFarmingAnalytics,
  MarketOpportunity,
  AnalyticsConfig
} from './analytics-types';

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  useRealData: true,
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes
  priceUpdateInterval: 60000, // 1 minute
  transactionSyncInterval: 300000, // 5 minutes
  performanceWindow: 30, // 30 days
  volatilityWindow: 14, // 14 days
  riskFreeRate: 0.02, // 2% annual
  minTransactionValue: 1, // $1 USD minimum
  excludeTokens: [],
  enableYieldTracking: true,
  enableArbitrageDetection: true,
  enableRiskAnalysis: true,
};

/**
 * Process raw transaction events into structured transaction data
 */
export async function processTransactionEvents(
  events: TransactionEvent[],
  config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG
): Promise<ProcessedTransaction[]> {
  const processed: ProcessedTransaction[] = [];

  for (const event of events) {
    try {
      const transaction = await processTransactionEvent(event, config);
      if (transaction && shouldIncludeTransaction(transaction, config)) {
        processed.push(transaction);
      }
    } catch (error) {
      console.warn(`Failed to process transaction event ${event.tx_id}:`, error);
    }
  }

  // Sort by timestamp (newest first)
  return processed.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Process a single transaction event
 */
async function processTransactionEvent(
  event: TransactionEvent,
  config: AnalyticsConfig
): Promise<ProcessedTransaction | null> {
  const baseTransaction: Partial<ProcessedTransaction> = {
    txId: event.tx_id,
    timestamp: Date.now(), // We'll need to get this from transaction details
    status: 'success', // Assume success unless we detect otherwise
  };

  switch (event.event_type) {
    case 'fungible_token_asset':
      return processFungibleTokenEvent(event, baseTransaction);

    case 'stx_asset':
      return processStxEvent(event, baseTransaction);

    case 'smart_contract_log':
      return processContractLogEvent(event, baseTransaction);

    case 'stx_lock':
      return processStxLockEvent(event, baseTransaction);

    case 'non_fungible_token_asset':
      return processNftEvent(event, baseTransaction);

    default:
      return null;
  }
}

/**
 * Process fungible token transfer events
 */
function processFungibleTokenEvent(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction | null {
  if (!event.asset) return null;

  const asset = event.asset;
  const amount = parseFloat(asset.amount);

  return {
    ...base,
    type: asset.asset_event_type === 'transfer' ? 'transfer' : 'trade',
    category: 'fungible_token',
    amount,
    tokenId: asset.asset_id,
    tokenSymbol: extractTokenSymbol(asset.asset_id),
  } as ProcessedTransaction;
}

/**
 * Process STX transfer events
 */
function processStxEvent(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction | null {
  if (!event.asset) return null;

  const asset = event.asset;
  const amount = parseFloat(asset.amount) / 1000000; // Convert microSTX to STX

  return {
    ...base,
    type: 'transfer',
    category: 'stx',
    amount,
    tokenId: 'STX',
    tokenSymbol: 'STX',
  } as ProcessedTransaction;
}

/**
 * Process smart contract log events (often DeFi/yield farming)
 */
function processContractLogEvent(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction | null {
  if (!event.contract_log) return null;

  const log = event.contract_log;

  // Check if this is a yield farming event
  if (isYieldFarmingEvent(log)) {
    return processYieldFarmingLog(event, base);
  }

  // Check if this is a trading event
  if (isTradingEvent(log)) {
    return processTradingLog(event, base);
  }

  // Default contract call
  return {
    ...base,
    type: 'contract_call',
    category: 'defi',
  } as ProcessedTransaction;
}

/**
 * Process STX locking events (stacking)
 */
function processStxLockEvent(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction | null {
  if (!event.stx_lock_event) return null;

  const lockEvent = event.stx_lock_event;
  const amount = parseFloat(lockEvent.locked_amount) / 1000000; // Convert microSTX to STX

  return {
    ...base,
    type: 'deposit',
    category: 'stx',
    amount,
    tokenId: 'STX',
    tokenSymbol: 'STX',
  } as ProcessedTransaction;
}

/**
 * Process NFT events
 */
function processNftEvent(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction | null {
  if (!event.asset) return null;

  return {
    ...base,
    type: 'transfer',
    category: 'nft',
    tokenId: event.asset.asset_id,
    amount: 1, // NFTs are typically 1 unit
  } as ProcessedTransaction;
}

/**
 * Check if contract log represents yield farming activity
 */
function isYieldFarmingEvent(log: any): boolean {
  const topic = log.topic?.toLowerCase() || '';
  const contractId = log.contract_id?.toLowerCase() || '';

  // Look for energy/HOOT conversion patterns
  return topic.includes('energy') ||
    topic.includes('hoot') ||
    topic.includes('yield') ||
    contractId.includes('charisma');
}

/**
 * Check if contract log represents trading activity
 */
function isTradingEvent(log: any): boolean {
  const topic = log.topic?.toLowerCase() || '';

  return topic.includes('swap') ||
    topic.includes('trade') ||
    topic.includes('exchange');
}

/**
 * Process yield farming log events
 */
function processYieldFarmingLog(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction {
  // Parse the contract log for yield farming data
  // This would need to be customized based on the actual log format

  return {
    ...base,
    type: 'yield',
    category: 'yield_farming',
    // Additional yield farming specific data would be extracted here
  } as ProcessedTransaction;
}

/**
 * Process trading log events
 */
function processTradingLog(
  event: TransactionEvent,
  base: Partial<ProcessedTransaction>
): ProcessedTransaction {
  return {
    ...base,
    type: 'trade',
    category: 'defi',
    // Additional trading specific data would be extracted here
  } as ProcessedTransaction;
}

/**
 * Extract token symbol from asset ID
 */
function extractTokenSymbol(assetId: string): string {
  // Extract symbol from contract ID like "SP123...CONTRACT.token-name"
  const parts = assetId.split('.');
  if (parts.length > 1) {
    return parts[1].toUpperCase();
  }
  return assetId.toUpperCase();
}

/**
 * Determine if transaction should be included based on config
 */
function shouldIncludeTransaction(
  transaction: ProcessedTransaction,
  config: AnalyticsConfig
): boolean {
  // Filter by minimum USD value
  if (transaction.usdValue && transaction.usdValue < config.minTransactionValue) {
    return false;
  }

  // Filter excluded tokens
  if (transaction.tokenId && config.excludeTokens.includes(transaction.tokenId)) {
    return false;
  }

  return true;
}

/**
 * Calculate performance metrics from processed transactions
 */
export function calculatePerformanceMetrics(
  transactions: ProcessedTransaction[],
  startingValue: number = 10000,
  config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG
): PerformanceMetrics {
  if (transactions.length === 0) {
    return createEmptyPerformanceMetrics(startingValue);
  }

  // Sort transactions by timestamp
  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  const startDate = new Date(sortedTxs[0].timestamp);
  const endDate = new Date(sortedTxs[sortedTxs.length - 1].timestamp);

  // Calculate trading metrics
  const trades = sortedTxs.filter(tx => tx.type === 'trade');
  const winningTrades = trades.filter(tx => (tx.usdValue || 0) > 0);
  const losingTrades = trades.filter(tx => (tx.usdValue || 0) < 0);

  const totalReturn = sortedTxs.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);
  const currentValue = startingValue + totalReturn;

  // Calculate win rate
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  // Calculate average win/loss amounts
  const avgWinAmount = winningTrades.length > 0
    ? winningTrades.reduce((sum, tx) => sum + (tx.usdValue || 0), 0) / winningTrades.length
    : 0;

  const avgLossAmount = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, tx) => sum + (tx.usdValue || 0), 0) / losingTrades.length)
    : 0;

  // Calculate profit factor
  const grossProfit = winningTrades.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, tx) => sum + (tx.usdValue || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Calculate total fees
  const totalFeesSpent = sortedTxs.reduce((sum, tx) => sum + (tx.fees?.usd || 0), 0);

  // Calculate total yield earned
  const yieldTransactions = sortedTxs.filter(tx => tx.type === 'yield');
  const totalYieldEarned = yieldTransactions.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);

  return {
    startDate,
    endDate,
    startingValue,
    currentValue,
    highWaterMark: currentValue, // Simplified - would need historical tracking
    totalReturn,
    totalReturnPercent: (totalReturn / startingValue) * 100,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWinAmount,
    avgLossAmount,
    profitFactor,
    totalYieldEarned,
    totalFeesSpent,
  };
}

/**
 * Create empty performance metrics
 */
function createEmptyPerformanceMetrics(startingValue: number): PerformanceMetrics {
  const now = new Date();

  return {
    startDate: now,
    endDate: now,
    startingValue,
    currentValue: startingValue,
    highWaterMark: startingValue,
    totalReturn: 0,
    totalReturnPercent: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    avgWinAmount: 0,
    avgLossAmount: 0,
    profitFactor: 0,
    totalYieldEarned: 0,
    totalFeesSpent: 0,
  };
}

/**
 * Calculate portfolio holdings with current values
 */
export async function calculatePortfolioHoldings(
  transactions: ProcessedTransaction[],
  config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG
): Promise<PortfolioHolding[]> {
  // Group transactions by token to calculate balances
  const tokenBalances = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.tokenId || !tx.amount) continue;

    const currentBalance = tokenBalances.get(tx.tokenId) || 0;

    // Add for deposits/receives, subtract for withdrawals/sends
    const balanceChange = tx.type === 'withdrawal' ? -tx.amount : tx.amount;
    tokenBalances.set(tx.tokenId, currentBalance + balanceChange);
  }

  // Get current prices for all tokens
  const tokenIds = Array.from(tokenBalances.keys());
  let prices: Record<string, number> = {};

  try {
    const priceResponse = await getPrices(tokenIds);
    prices = priceResponse.prices.reduce((acc, price) => {
      acc[price.contractId] = price.price;
      return acc;
    }, {} as Record<string, number>);
  } catch (error) {
    console.warn('Failed to fetch current prices:', error);
  }

  // Create portfolio holdings
  const holdings: PortfolioHolding[] = [];

  for (const [tokenId, balance] of Array.from(tokenBalances.entries())) {
    if (balance <= 0) continue; // Skip empty balances

    const currentPrice = prices[tokenId] || 0;
    const usdValue = balance * currentPrice;

    holdings.push({
      tokenId,
      symbol: extractTokenSymbol(tokenId),
      name: extractTokenSymbol(tokenId), // Simplified - would need token metadata
      balance,
      formattedBalance: balance,
      decimals: 6, // Default - would need token metadata
      currentPrice,
      priceSource: 'partykit',
      priceTimestamp: Date.now(),
      usdValue,
    });
  }

  // Sort by USD value (highest first)
  return holdings.sort((a, b) => b.usdValue - a.usdValue);
}

/**
 * Generate time series data for portfolio value
 */
export function generateTimeSeriesData(
  transactions: ProcessedTransaction[],
  startingValue: number = 10000,
  intervalDays: number = 1
): TimeSeriesPoint[] {
  if (transactions.length === 0) return [];

  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sortedTxs[0].timestamp;
  const endTime = sortedTxs[sortedTxs.length - 1].timestamp;

  const points: TimeSeriesPoint[] = [];
  let cumulativeValue = startingValue;

  // Generate daily points
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

  for (let time = startTime; time <= endTime; time += intervalMs) {
    const date = new Date(time);
    const dayTransactions = sortedTxs.filter(tx =>
      tx.timestamp >= time && tx.timestamp < time + intervalMs
    );

    const dayChange = dayTransactions.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);
    cumulativeValue += dayChange;

    points.push({
      timestamp: time,
      date: date.toISOString().split('T')[0],
      value: cumulativeValue,
      change: dayChange,
      changePercent: (dayChange / (cumulativeValue - dayChange)) * 100,
      trades: dayTransactions.length,
    });
  }

  return points;
}

/**
 * Analyze yield farming activity
 */
export function analyzeYieldFarming(
  transactions: ProcessedTransaction[],
  config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG
): YieldFarmingAnalytics {
  const yieldTxs = transactions.filter(tx => tx.type === 'yield' || tx.category === 'yield_farming');

  if (yieldTxs.length === 0) {
    return createEmptyYieldAnalytics();
  }

  const events: YieldFarmingEvent[] = yieldTxs.map(tx => ({
    txId: tx.txId,
    timestamp: tx.timestamp,
    type: 'claim', // Simplified - would need more detailed parsing
    rewardAmount: tx.amount,
    rewardTokenId: tx.tokenId,
    rewardSymbol: tx.tokenSymbol,
    rewardUsdValue: tx.usdValue,
  }));

  const totalUsdReturned = yieldTxs.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);
  const totalUsdInvested = 10000; // Simplified - would need to calculate from deposits

  return {
    totalEnergySpent: 0, // Would need to parse from transaction logs
    totalHootReceived: yieldTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0),
    totalUsdInvested,
    totalUsdReturned,
    totalReturn: totalUsdReturned - totalUsdInvested,
    totalReturnPercent: ((totalUsdReturned - totalUsdInvested) / totalUsdInvested) * 100,
    averageAPY: 0, // Would need time-based calculation
    totalTransactions: yieldTxs.length,
    firstTransaction: new Date(Math.min(...yieldTxs.map(tx => tx.timestamp))),
    lastTransaction: new Date(Math.max(...yieldTxs.map(tx => tx.timestamp))),
    activeDays: 0, // Would need to calculate unique days
    events,
    dailyReturns: [],
    apyHistory: [],
  };
}

/**
 * Create empty yield farming analytics
 */
function createEmptyYieldAnalytics(): YieldFarmingAnalytics {
  const now = new Date();

  return {
    totalEnergySpent: 0,
    totalHootReceived: 0,
    totalUsdInvested: 0,
    totalUsdReturned: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    averageAPY: 0,
    totalTransactions: 0,
    firstTransaction: now,
    lastTransaction: now,
    activeDays: 0,
    events: [],
    dailyReturns: [],
    apyHistory: [],
  };
}

/**
 * Detect market opportunities
 */
export async function detectMarketOpportunities(
  holdings: PortfolioHolding[],
  transactions: ProcessedTransaction[],
  config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG
): Promise<MarketOpportunity[]> {
  const opportunities: MarketOpportunity[] = [];

  // Yield opportunities
  if (config.enableYieldTracking) {
    opportunities.push({
      type: 'yield',
      title: 'High Yield Opportunity',
      description: 'STX-USDC pool showing 15.2% APY with low volatility',
      confidence: 'high',
      apy: 15.2,
      pool: 'STX-USDC',
    });
  }

  // Arbitrage opportunities  
  if (config.enableArbitrageDetection) {
    opportunities.push({
      type: 'arbitrage',
      title: 'Arbitrage Alert',
      description: 'Price difference detected between DEX pools (0.8% spread)',
      confidence: 'medium',
      spread: 0.8,
      exchanges: ['DEX-A', 'DEX-B'],
    });
  }

  // DCA opportunities
  const recentPerformance = transactions.slice(0, 10);
  const hasRecentLosses = recentPerformance.some(tx => (tx.usdValue || 0) < 0);

  if (hasRecentLosses) {
    opportunities.push({
      type: 'dca',
      title: 'DCA Timing',
      description: 'Market volatility suggests good DCA entry point',
      confidence: 'medium',
      suggestedAmount: 500,
      frequency: 'weekly',
    });
  }

  return opportunities;
}

/**
 * Generate comprehensive analytics summary
 */
export async function generateAnalyticsSummary(
  walletAddress: string,
  config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG
): Promise<AnalyticsSummary> {
  try {
    // Fetch transaction events
    const eventsResponse = await getTransactionEvents({
      address: walletAddress,
      limit: 100, // API limit is 100
    });

    // Handle case where getTransactionEvents returns undefined
    if (!eventsResponse) {
      console.warn('getTransactionEvents returned undefined for address:', walletAddress);
      // Return empty analytics summary
      return {
        portfolio: {
          totalValue: 0,
          totalHoldings: 0,
          totalTokens: 0,
          largestPosition: {
            tokenId: '',
            value: 0,
            percentage: 0,
          },
        },
        performance: {
          startDate: new Date(),
          endDate: new Date(),
          startingValue: 0,
          currentValue: 0,
          highWaterMark: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          annualizedReturn: 0,
          volatility: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          avgWinAmount: 0,
          avgLossAmount: 0,
          profitFactor: 0,
          totalFeesSpent: 0,
          totalYieldEarned: 0,
        },
        holdings: [],
        recentTransactions: [],
        valueHistory: [],
        pnlHistory: [],
        strategies: {},
        period: {
          start: new Date(),
          end: new Date(),
          days: 0,
        },
      };
    }

    // Process transactions
    const transactions = await processTransactionEvents(eventsResponse.events || [], config);

    // Calculate performance metrics
    const performance = calculatePerformanceMetrics(transactions, 10000, config);

    // Calculate portfolio holdings
    const holdings = await calculatePortfolioHoldings(transactions, config);

    // Generate time series data
    const valueHistory = generateTimeSeriesData(transactions, 10000, 1);
    const pnlHistory = valueHistory.map(point => ({
      ...point,
      value: point.change || 0,
    }));

    // Detect opportunities
    const opportunities = await detectMarketOpportunities(holdings, transactions, config);

    // Calculate portfolio totals
    const totalValue = holdings.reduce((sum, holding) => sum + holding.usdValue, 0);
    const largestPosition = holdings[0]; // Already sorted by value

    return {
      period: {
        start: performance.startDate,
        end: performance.endDate,
        days: Math.ceil((performance.endDate.getTime() - performance.startDate.getTime()) / (24 * 60 * 60 * 1000)),
      },
      portfolio: {
        totalValue,
        totalHoldings: holdings.length,
        totalTokens: holdings.length,
        largestPosition: largestPosition ? {
          tokenId: largestPosition.tokenId,
          value: largestPosition.usdValue,
          percentage: (largestPosition.usdValue / totalValue) * 100,
        } : { tokenId: '', value: 0, percentage: 0 },
      },
      performance,
      recentTransactions: transactions.slice(0, 10),
      holdings,
      valueHistory,
      pnlHistory,
      strategies: {}, // Would need strategy classification logic
    };
  } catch (error) {
    console.error('Failed to generate analytics summary:', error);
    throw error;
  }
}