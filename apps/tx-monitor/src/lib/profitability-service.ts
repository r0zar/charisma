/**
 * Real profitability calculation service
 * Calculates actual P&L based on entry prices and current/historical prices
 */

import { ActivityItem } from './activity-types';
import {
  ProfitabilityData,
  ProfitabilityMetrics,
  ProfitabilityDataPoint,
  ProfitabilityCalculationInput,
  CurrentPriceData,
  HistoricalPricePoint,
  TimeRange
} from './profitability-types';
import { listTokens, listPrices, type TokenCacheData } from '@repo/tokens';
import { getHostUrl } from '@modules/discovery';

// Token mapping cache
let tokenMappingCache: Record<string, string> | null = null;
let tokenMappingCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get dynamic symbol-to-contract mapping using @repo/tokens
 */
async function getTokenMapping(): Promise<Record<string, string>> {
  const now = Date.now();

  // Return cached mapping if still fresh
  if (tokenMappingCache && (now - tokenMappingCacheTimestamp) < CACHE_DURATION) {
    return tokenMappingCache;
  }

  try {
    console.log('[getTokenMapping] Fetching fresh token mappings from @repo/tokens');
    const tokens = await listTokens();

    const mapping: Record<string, string> = {};

    for (const token of tokens) {
      if (token.symbol && token.contractId) {
        mapping[token.symbol] = token.contractId;
      }
    }

    // Cache the mapping
    tokenMappingCache = mapping;
    tokenMappingCacheTimestamp = now;

    console.log(`[getTokenMapping] Cached mappings for ${Object.keys(mapping).length} tokens`);
    return mapping;
  } catch (error) {
    console.error('[getTokenMapping] Error fetching token mappings:', error);

    // Return cached mapping if available, even if expired
    if (tokenMappingCache) {
      console.warn('[getTokenMapping] Using expired cache due to fetch error');
      return tokenMappingCache;
    }

    // Fallback to minimal mapping if no cache available
    console.warn('[getTokenMapping] Using minimal fallback mapping');
    return {
      'CHA': 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'aeUSDC': 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
      'STX': '.stx'
    };
  }
}

/**
 * Calculate profitability for a completed trade activity
 */
export async function calculateTradeProfitability(activity: ActivityItem): Promise<ProfitabilityData | null> {
  // Input validation
  if (!activity) {
    console.error('[PROFITABILITY] Activity is null or undefined');
    return null;
  }

  if (!activity.id) {
    console.error('[PROFITABILITY] Activity missing required id field');
    return null;
  }

  // Debug: Log the activity data to see what we're working with
  console.log(`[PROFITABILITY] Calculating for activity ${activity.id}:`, {
    status: activity.status,
    type: activity.type,
    fromToken: {
      symbol: activity.fromToken?.symbol,
      amount: activity.fromToken?.amount,
      usdValue: activity.fromToken?.usdValue,
      priceSnapshot: activity.fromToken?.priceSnapshot
    },
    toToken: {
      symbol: activity.toToken?.symbol,
      amount: activity.toToken?.amount,
      usdValue: activity.toToken?.usdValue,
      priceSnapshot: activity.toToken?.priceSnapshot
    }
  });

  // Only calculate for completed instant swaps
  if (activity.status !== 'completed' || activity.type !== 'instant_swap') {
    console.log(`[PROFITABILITY] Skipping - status: ${activity.status}, type: ${activity.type}`);
    return null;
  }

  // Validate required token data
  if (!activity.fromToken || !activity.toToken) {
    console.error(`[PROFITABILITY] Missing token data for activity ${activity.id}`);
    return null;
  }

  if (!activity.fromToken.contractId || !activity.toToken.contractId) {
    console.error(`[PROFITABILITY] Missing token contract IDs for activity ${activity.id}`);
    return null;
  }

  if (!activity.fromToken.amount || !activity.toToken.amount) {
    console.error(`[PROFITABILITY] Missing token amounts for activity ${activity.id}`);
    return null;
  }

  // Additional validation for zero amounts
  if (activity.fromToken.amount === '0' || activity.toToken.amount === '0') {
    console.error(`[PROFITABILITY] Zero token amounts detected for activity ${activity.id}: input=${activity.fromToken.amount}, output=${activity.toToken.amount}`);
    return null;
  }

  // Validate timestamp
  if (!activity.timestamp || activity.timestamp <= 0) {
    console.error(`[PROFITABILITY] Invalid timestamp for activity ${activity.id}: ${activity.timestamp}`);
    return null;
  }

  // Validate timestamp is not in the future
  if (activity.timestamp > Date.now() + 60000) { // Allow 1 minute clock skew
    console.error(`[PROFITABILITY] Timestamp in future for activity ${activity.id}: ${activity.timestamp}`);
    return null;
  }

  // Try to get entry prices from price snapshots or fallback to calculated prices
  const entryPrices = await getEntryPrices(activity);
  if (!entryPrices) {
    console.warn(`[PROFITABILITY] Unable to determine entry prices for activity ${activity.id}`);
    return null;
  }

  console.log(`[PROFITABILITY] Using entry prices:`, entryPrices);

  // Apply decimal conversion to amounts with bounds checking
  const inputAmountRaw = parseFloat(activity.fromToken.amount);
  const outputAmountRaw = parseFloat(activity.toToken.amount);

  // Validate parsed amounts
  if (isNaN(inputAmountRaw) || isNaN(outputAmountRaw)) {
    console.error(`[PROFITABILITY] Invalid amount values for activity ${activity.id}: input=${activity.fromToken.amount}, output=${activity.toToken.amount}`);
    return null;
  }

  if (inputAmountRaw <= 0 || outputAmountRaw <= 0) {
    console.error(`[PROFITABILITY] Non-positive amounts for activity ${activity.id}: input=${inputAmountRaw}, output=${outputAmountRaw}`);
    return null;
  }

  // Validate and constrain decimal places
  const inputDecimals = Math.max(0, Math.min(18, activity.fromToken.decimals || 6)); // Constrain to 0-18 decimals
  const outputDecimals = Math.max(0, Math.min(18, activity.toToken.decimals || 6));

  // Calculate decimal-adjusted amounts
  const inputAmount = inputAmountRaw / Math.pow(10, inputDecimals);
  const outputAmount = outputAmountRaw / Math.pow(10, outputDecimals);

  // Validate calculated amounts are reasonable
  if (inputAmount <= 0 || outputAmount <= 0) {
    console.error(`[PROFITABILITY] Zero or negative decimal-adjusted amounts for activity ${activity.id}: input=${inputAmount}, output=${outputAmount}`);
    return null;
  }

  // Sanity check: amounts shouldn't be impossibly large
  const MAX_REASONABLE_AMOUNT = 1e15; // 1 quadrillion
  if (inputAmount > MAX_REASONABLE_AMOUNT || outputAmount > MAX_REASONABLE_AMOUNT) {
    console.error(`[PROFITABILITY] Unreasonably large amounts for activity ${activity.id}: input=${inputAmount}, output=${outputAmount}`);
    return null;
  }

  const input: ProfitabilityCalculationInput = {
    activityId: activity.id,
    entryPrices,
    amounts: {
      inputAmount,
      outputAmount
    },
    tradeTimestamp: activity.timestamp,
    tokenContracts: {
      inputContractId: activity.fromToken.contractId,
      outputContractId: activity.toToken.contractId
    }
  };

  try {
    // Get current prices
    const currentPrices = await getCurrentPrices([
      activity.fromToken.contractId,
      activity.toToken.contractId
    ]);

    // Get historical price data for chart
    const historicalData = await getHistoricalPriceData(
      activity.fromToken.contractId,
      activity.toToken.contractId,
      activity.timestamp,
      Date.now()
    );

    // Calculate profitability metrics
    const profitabilityData = calculateProfitabilityFromData(
      input,
      currentPrices,
      historicalData
    );

    return profitabilityData;
  } catch (error) {
    console.error(`Error calculating profitability for activity ${activity.id}:`, error);
    return null;
  }
}

/**
 * Get entry prices with multiple fallback strategies
 */
async function getEntryPrices(activity: ActivityItem): Promise<{ inputToken: number; outputToken: number } | null> {
  // Strategy 1: Use price snapshots if available
  if (activity.fromToken.priceSnapshot && activity.toToken.priceSnapshot) {
    const inputPrice = activity.fromToken.priceSnapshot.price;
    const outputPrice = activity.toToken.priceSnapshot.price;

    // Validate price snapshot values
    if (isNaN(inputPrice) || isNaN(outputPrice) || inputPrice <= 0 || outputPrice <= 0) {
      console.warn(`[getEntryPrices] Invalid price snapshot values for activity ${activity.id}: input=${inputPrice}, output=${outputPrice}`);
    } else {
      // Sanity check: prices shouldn't be impossibly large
      const MAX_REASONABLE_PRICE = 1e9; // 1 billion USD per token
      if (inputPrice <= MAX_REASONABLE_PRICE && outputPrice <= MAX_REASONABLE_PRICE) {
        return {
          inputToken: inputPrice,
          outputToken: outputPrice
        };
      } else {
        console.warn(`[getEntryPrices] Unreasonably large price snapshot values for activity ${activity.id}: input=${inputPrice}, output=${outputPrice}`);
      }
    }
  }

  // Strategy 2: Calculate from USD values if available
  if (activity.fromToken.usdValue && activity.toToken.usdValue) {
    const inputAmountRaw = parseFloat(activity.fromToken.amount);
    const outputAmountRaw = parseFloat(activity.toToken.amount);

    // Validate raw amounts
    if (isNaN(inputAmountRaw) || isNaN(outputAmountRaw) || inputAmountRaw <= 0 || outputAmountRaw <= 0) {
      console.warn(`[getEntryPrices] Invalid raw amounts for USD calculation in activity ${activity.id}: input=${inputAmountRaw}, output=${outputAmountRaw}`);
    } else {
      // Apply decimal conversion to get actual token amounts
      const inputDecimals = Math.max(0, Math.min(18, activity.fromToken.decimals || 6));
      const outputDecimals = Math.max(0, Math.min(18, activity.toToken.decimals || 6));

      const inputAmount = inputAmountRaw / Math.pow(10, inputDecimals);
      const outputAmount = outputAmountRaw / Math.pow(10, outputDecimals);

      // Validate USD values
      if (activity.fromToken.usdValue <= 0 || activity.toToken.usdValue <= 0) {
        console.warn(`[getEntryPrices] Non-positive USD values for activity ${activity.id}: input=${activity.fromToken.usdValue}, output=${activity.toToken.usdValue}`);
      } else if (inputAmount > 0 && outputAmount > 0) {
        const inputPrice = activity.fromToken.usdValue / inputAmount;
        const outputPrice = activity.toToken.usdValue / outputAmount;

        // Validate calculated prices
        if (isNaN(inputPrice) || isNaN(outputPrice) || inputPrice <= 0 || outputPrice <= 0) {
          console.warn(`[getEntryPrices] Invalid calculated prices for activity ${activity.id}: input=${inputPrice}, output=${outputPrice}`);
        } else {
          // Sanity check: calculated prices shouldn't be impossibly large
          const MAX_REASONABLE_PRICE = 1e9;
          if (inputPrice <= MAX_REASONABLE_PRICE && outputPrice <= MAX_REASONABLE_PRICE) {
            return {
              inputToken: inputPrice,
              outputToken: outputPrice
            };
          } else {
            console.warn(`[getEntryPrices] Unreasonably large calculated prices for activity ${activity.id}: input=${inputPrice}, output=${outputPrice}`);
          }
        }
      }
    }
  }

  // Strategy 3: Calculate entry price from swap execution data
  // This is the CRITICAL fix for stablecoin → volatile token swaps
  const stablecoins = ['USDC', 'aeUSDC', 'USDT', 'USDh'];
  const isFromStable = stablecoins.some(stable => activity.fromToken.symbol.includes(stable));
  const isToStable = stablecoins.some(stable => activity.toToken.symbol.includes(stable));

  if (isFromStable && !isToStable) {
    // Stablecoin to volatile token swap - calculate real entry price
    const inputAmountRaw = parseFloat(activity.fromToken.amount);
    const outputAmountRaw = parseFloat(activity.toToken.amount);

    if (inputAmountRaw > 0 && outputAmountRaw > 0) {
      const inputDecimals = Math.max(0, Math.min(18, activity.fromToken.decimals || 6));
      const outputDecimals = Math.max(0, Math.min(18, activity.toToken.decimals || 6));

      const inputAmount = inputAmountRaw / Math.pow(10, inputDecimals);
      const outputAmount = outputAmountRaw / Math.pow(10, outputDecimals);

      // Calculate real entry price: input USD value ÷ output token amount
      const realEntryPrice = inputAmount / outputAmount; // Assuming stablecoin ≈ $1

      console.log(`[getEntryPrices] Calculated real entry price for ${activity.id}: ${inputAmount} ${activity.fromToken.symbol} ÷ ${outputAmount} ${activity.toToken.symbol} = $${realEntryPrice.toFixed(6)} per ${activity.toToken.symbol}`);

      return {
        inputToken: 1.0, // Stablecoin ≈ $1
        outputToken: realEntryPrice // Real calculated entry price
      };
    }
  }

  // Strategy 4: For stablecoin-to-stablecoin or other pairs
  if (isFromStable && isToStable) {
    console.log(`[getEntryPrices] Stablecoin-to-stablecoin swap for activity ${activity.id}`);
    return {
      inputToken: 1.0,
      outputToken: 1.0
    };
  }

  // Strategy 5: Fallback for other token types (but avoid wrong assumptions)
  console.warn(`[getEntryPrices] No suitable entry price strategy found for activity ${activity.id} - ${activity.fromToken.symbol} → ${activity.toToken.symbol}`);
  return null;
}


/**
 * Calculate profitability from price data
 */
function calculateProfitabilityFromData(
  input: ProfitabilityCalculationInput,
  currentPrices: CurrentPriceData[],
  historicalData: HistoricalPricePoint[][]
): ProfitabilityData {
  const { entryPrices, amounts, tradeTimestamp, tokenContracts } = input;

  // Find current prices using contract IDs
  const currentInputPrice = currentPrices.find(p => p.contractId === tokenContracts.inputContractId)?.price;
  const currentOutputPrice = currentPrices.find(p => p.contractId === tokenContracts.outputContractId)?.price;

  if (!currentInputPrice || !currentOutputPrice) {
    throw new Error('Current prices not available');
  }

  // Calculate original trade value in USD
  const originalTradeValue = amounts.inputAmount * entryPrices.inputToken;

  // Calculate current position value
  const currentPositionValue = amounts.outputAmount * currentOutputPrice;

  // Calculate current P&L
  const currentPnLUsd = currentPositionValue - originalTradeValue;
  const currentPnLPercentage = (currentPnLUsd / originalTradeValue) * 100;

  // Generate chart data from historical prices
  const chartData = generateChartDataFromHistoricalPrices(
    historicalData,
    amounts,
    entryPrices,
    originalTradeValue,
    tradeTimestamp
  );

  // Calculate metrics from chart data
  const metrics = calculateMetricsFromChartData(chartData, tradeTimestamp);

  // Update current metrics with live prices
  metrics.currentPnL = {
    percentage: currentPnLPercentage,
    usdValue: currentPnLUsd
  };

  // CRITICAL FIX: Update best/worst to include current P&L
  // The current P&L uses live prices and might be more recent than chart data
  if (currentPnLPercentage > metrics.bestPerformance.percentage) {
    metrics.bestPerformance = {
      percentage: currentPnLPercentage,
      usdValue: currentPnLUsd,
      timestamp: Date.now()
    };
  }

  if (currentPnLPercentage < metrics.worstPerformance.percentage) {
    metrics.worstPerformance = {
      percentage: currentPnLPercentage,
      usdValue: currentPnLUsd,
      timestamp: Date.now()
    };
  }

  // Calculate token breakdown
  const inputTokenChange = ((currentInputPrice - entryPrices.inputToken) / entryPrices.inputToken) * 100;
  const outputTokenChange = ((currentOutputPrice - entryPrices.outputToken) / entryPrices.outputToken) * 100;

  return {
    metrics,
    chartData,
    tokenBreakdown: {
      inputTokenChange,
      outputTokenChange,
      netEffect: currentPnLPercentage
    }
  };
}

/**
 * Generate chart data points from historical price data
 */
function generateChartDataFromHistoricalPrices(
  historicalData: HistoricalPricePoint[][],
  amounts: { inputAmount: number; outputAmount: number },
  entryPrices: { inputToken: number; outputToken: number },
  originalTradeValue: number,
  tradeTimestamp: number
): ProfitabilityDataPoint[] {
  const [inputHistory, outputHistory] = historicalData;

  const chartData: ProfitabilityDataPoint[] = [];

  // Merge and sort historical data points
  const allTimestamps = new Set([
    ...inputHistory.map(p => p.timestamp),
    ...outputHistory.map(p => p.timestamp)
  ]);

  const sortedTimestamps = Array.from(allTimestamps)
    .filter(ts => ts >= tradeTimestamp)
    .sort((a, b) => a - b);

  // Add entry point
  const entryTime = Math.floor(tradeTimestamp / 1000);
  chartData.push({
    time: entryTime,
    value: 0,
    usdValue: 0
  });

  for (const timestamp of sortedTimestamps) {
    const chartTime = Math.floor(timestamp / 1000);

    // Skip if this timestamp would create duplicate or out-of-order entries
    if (chartTime <= entryTime) {
      continue;
    }

    // Skip if this would create a duplicate timestamp
    if (chartData.length > 0 && chartData[chartData.length - 1].time >= chartTime) {
      continue;
    }

    // Find closest prices for this timestamp
    const inputPrice = findClosestPrice(inputHistory, timestamp) || entryPrices.inputToken;
    const outputPrice = findClosestPrice(outputHistory, timestamp) || entryPrices.outputToken;

    // Calculate position value at this point
    const positionValue = amounts.outputAmount * outputPrice;
    const pnlUsd = positionValue - originalTradeValue;
    const pnlPercentage = (pnlUsd / originalTradeValue) * 100;

    chartData.push({
      time: chartTime,
      value: Number(pnlPercentage.toFixed(2)),
      usdValue: Number(pnlUsd.toFixed(2))
    });
  }

  // If no historical data, add a current point to show some progression
  if (chartData.length === 1) {
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > entryTime) {
      // Use the same entry prices as current prices for a flat line
      const positionValue = amounts.outputAmount * entryPrices.outputToken;
      const pnlUsd = positionValue - originalTradeValue;
      const pnlPercentage = (pnlUsd / originalTradeValue) * 100;

      chartData.push({
        time: currentTime,
        value: Number(pnlPercentage.toFixed(2)),
        usdValue: Number(pnlUsd.toFixed(2))
      });
    }
  }

  // Final sort to ensure strict ascending order
  chartData.sort((a, b) => a.time - b.time);

  // Remove any duplicate timestamps (keep the last one)
  const uniqueChartData: ProfitabilityDataPoint[] = [];
  let lastTime = -1;

  for (const point of chartData) {
    if (point.time > lastTime) {
      uniqueChartData.push(point);
      lastTime = point.time;
    }
  }

  return uniqueChartData;
}

/**
 * Find the closest price to a given timestamp
 */
function findClosestPrice(priceHistory: HistoricalPricePoint[], targetTimestamp: number): number | null {
  if (priceHistory.length === 0) return null;

  let closest = priceHistory[0];
  let minDiff = Math.abs(targetTimestamp - closest.timestamp);

  for (const point of priceHistory) {
    const diff = Math.abs(targetTimestamp - point.timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest.price;
}

/**
 * Calculate metrics from chart data
 */
function calculateMetricsFromChartData(
  chartData: ProfitabilityDataPoint[],
  tradeTimestamp: number
): ProfitabilityMetrics {
  if (chartData.length === 0) {
    throw new Error('No chart data available for metrics calculation');
  }

  // Find best and worst performance
  let bestPerformance = chartData[0];
  let worstPerformance = chartData[0];

  for (const point of chartData) {
    if (point.value > bestPerformance.value) {
      bestPerformance = point;
    }
    if (point.value < worstPerformance.value) {
      worstPerformance = point;
    }
  }

  // Calculate average return
  const totalReturn = chartData.reduce((sum, point) => sum + point.value, 0);
  const averageReturn = totalReturn / chartData.length;

  // Calculate time held
  const timeHeld = Date.now() - tradeTimestamp;

  return {
    currentPnL: {
      percentage: chartData[chartData.length - 1]?.value || 0,
      usdValue: chartData[chartData.length - 1]?.usdValue || 0
    },
    bestPerformance: {
      percentage: bestPerformance.value,
      usdValue: bestPerformance.usdValue,
      timestamp: bestPerformance.time * 1000
    },
    worstPerformance: {
      percentage: worstPerformance.value,
      usdValue: worstPerformance.usdValue,
      timestamp: worstPerformance.time * 1000
    },
    averageReturn,
    timeHeld
  };
}

/**
 * Get current prices for tokens using @repo/tokens directly
 */
async function getCurrentPrices(contractIds: string[]): Promise<CurrentPriceData[]> {
  try {
    console.log(`[getCurrentPrices] Getting prices for contract IDs: ${contractIds.join(', ')}`);

    // Use @repo/tokens directly to get current prices
    const priceData = await listPrices({
      strategy: 'fallback',
      sources: { stxtools: true, internal: true }
    });

    const results: CurrentPriceData[] = [];

    for (const contractId of contractIds) {
      let price: number;
      let source: string;

      if (priceData[contractId] !== undefined) {
        price = priceData[contractId];
        source = 'packages-tokens';
      } else if (contractId === '.stx' && (priceData['.stx'] !== undefined || priceData['stx'] !== undefined)) {
        price = priceData['.stx'] || priceData['stx'];
        source = 'packages-tokens';
      } else {
        // Fallback for stablecoins based on contract ID
        if (contractId.includes('usdc') || contractId.includes('USDC') ||
          contractId.includes('usdt') || contractId.includes('USDT') ||
          contractId.includes('dai') || contractId.includes('DAI')) {
          price = 1.0;
          source = 'stablecoin-fallback';
        } else {
          price = 1.0;
          source = 'final-fallback';
        }
        console.warn(`[getCurrentPrices] No price found for contract ID ${contractId}, using fallback: ${price}`);
      }

      results.push({
        contractId,
        price,
        timestamp: Date.now(),
        source
      });
    }

    console.log(`[getCurrentPrices] Retrieved prices for ${contractIds.length} contract IDs from @repo/tokens`);
    return results;
  } catch (error) {
    console.error(`[getCurrentPrices] Error getting prices from @repo/tokens:`, error);

    // Final fallback
    return contractIds.map(contractId => ({
      contractId,
      price: (contractId.includes('usdc') || contractId.includes('USDC') ||
        contractId.includes('usdt') || contractId.includes('USDT') ||
        contractId.includes('dai') || contractId.includes('DAI')) ? 1.0 : 1.0,
      timestamp: Date.now(),
      source: 'error-fallback'
    }));
  }
}

/**
 * Get historical price data for tokens using existing /api/price-series/bulk endpoint
 */
async function getHistoricalPriceData(
  inputContractId: string,
  outputContractId: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<HistoricalPricePoint[][]> {
  try {
    if (!inputContractId || !outputContractId) {
      console.warn(`[getHistoricalPriceData] Missing contract IDs, falling back to price store`);
      return await getHistoricalDataFromPriceStore(inputContractId, outputContractId, startTimestamp, endTimestamp);
    }

    // Convert timestamps to seconds for the API
    const fromSeconds = Math.floor(startTimestamp / 1000);
    const toSeconds = Math.floor(endTimestamp / 1000);

    // Call existing /api/price-series/bulk endpoint
    const contractIds = [inputContractId, outputContractId].join(',');
    const url = `${getHostUrl('swap')}/api/price-series/bulk?contractIds=${encodeURIComponent(contractIds)}&from=${fromSeconds}&to=${toSeconds}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.warn(`[getHistoricalPriceData] API call failed with status ${response.status}, falling back to local price store`);
      return await getHistoricalDataFromPriceStore(inputContractId, outputContractId, startTimestamp, endTimestamp);
    }

    const data = await response.json();

    // Convert API response to our format
    const inputData = data[inputContractId] || [];
    const outputData = data[outputContractId] || [];

    const inputHistory: HistoricalPricePoint[] = inputData.map((point: { time: number, value: number }) => ({
      timestamp: point.time * 1000, // Convert back to milliseconds
      price: point.value,
      source: 'price-series-bulk'
    }));

    const outputHistory: HistoricalPricePoint[] = outputData.map((point: { time: number, value: number }) => ({
      timestamp: point.time * 1000, // Convert back to milliseconds
      price: point.value,
      source: 'price-series-bulk'
    }));

    console.log(`[getHistoricalPriceData] Retrieved ${inputHistory.length} points for ${inputContractId}, ${outputHistory.length} points for ${outputContractId}`);

    return [inputHistory, outputHistory];
  } catch (error) {
    console.warn(`[getHistoricalPriceData] Error calling price-series/bulk API:`, error);
    return await getHistoricalDataFromPriceStore(inputContractId, outputContractId, startTimestamp, endTimestamp);
  }
}

/**
 * Fallback to get historical data via API call to simple-swap
 */
async function getHistoricalDataFromPriceStore(
  inputContractId: string,
  outputContractId: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<HistoricalPricePoint[][]> {
  try {
    if (!inputContractId || !outputContractId) {
      console.warn(`[getHistoricalDataFromPriceStore] Missing contract IDs`);
      return [[], []];
    }

    // Convert timestamps to seconds for the API
    const fromSeconds = Math.floor(startTimestamp / 1000);
    const toSeconds = Math.floor(endTimestamp / 1000);

    // Call simple-swap API endpoint directly (same as main function but as fallback)
    const contractIds = [inputContractId, outputContractId].join(',');
    const url = `${getHostUrl('swap')}/api/price-series/bulk?contractIds=${encodeURIComponent(contractIds)}&from=${fromSeconds}&to=${toSeconds}`;

    console.log(`[getHistoricalDataFromPriceStore] Calling simple-swap API as fallback: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`API call failed with status ${response.status}`);
    }

    const data = await response.json();

    // Convert API response to our format
    const inputData = data[inputContractId] || [];
    const outputData = data[outputContractId] || [];

    const inputHistory: HistoricalPricePoint[] = inputData.map((point: { time: number, value: number }) => ({
      timestamp: point.time * 1000, // Convert back to milliseconds
      price: point.value,
      source: 'price-store-api'
    }));

    const outputHistory: HistoricalPricePoint[] = outputData.map((point: { time: number, value: number }) => ({
      timestamp: point.time * 1000, // Convert back to milliseconds
      price: point.value,
      source: 'price-store-api'
    }));

    console.log(`[getHistoricalDataFromPriceStore] Retrieved ${inputHistory.length} points for ${inputContractId}, ${outputHistory.length} points for ${outputContractId} via API`);

    return [inputHistory, outputHistory];
  } catch (error) {
    console.error(`[getHistoricalDataFromPriceStore] Error calling simple-swap API:`, error);

    // Final fallback to minimal static data if everything fails
    console.warn(`[getHistoricalDataFromPriceStore] Using minimal fallback data for ${inputContractId}, ${outputContractId}`);

    const getSimplePrice = (contractId: string): number => {
      if (contractId.includes('usdc') || contractId.includes('USDC') ||
        contractId.includes('usdt') || contractId.includes('USDT') ||
        contractId.includes('dai') || contractId.includes('DAI')) {
        return 1.0;
      }
      return 1.0;
    };

    const inputPrice = getSimplePrice(inputContractId);
    const outputPrice = getSimplePrice(outputContractId);

    return [
      [{
        timestamp: startTimestamp,
        price: inputPrice,
        source: 'fallback'
      }],
      [{
        timestamp: startTimestamp,
        price: outputPrice,
        source: 'fallback'
      }]
    ];
  }
}

/**
 * Filter chart data by time range
 */
export function filterDataByTimeRange(
  data: ProfitabilityDataPoint[],
  timeRange: TimeRange
): ProfitabilityDataPoint[] {
  if (timeRange === 'ALL') return data;

  const now = Date.now() / 1000;
  let cutoffTime: number;

  switch (timeRange) {
    case '1H':
      cutoffTime = now - (60 * 60);
      break;
    case '24H':
      cutoffTime = now - (24 * 60 * 60);
      break;
    case '7D':
      cutoffTime = now - (7 * 24 * 60 * 60);
      break;
    case '30D':
      cutoffTime = now - (30 * 24 * 60 * 60);
      break;
    default:
      return data;
  }

  return data.filter(point => point.time >= cutoffTime);
}