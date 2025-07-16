/**
 * Portfolio-level profitability calculation service
 * Aggregates individual activity P&L data into portfolio totals
 */

import { ActivityItem } from './activity-types';
import { getUserActivityTimeline } from './activity-storage';
import { calculateTradeProfitability } from './profitability-service';
import {
  PortfolioProfitabilityData,
  PortfolioProfitabilityMetrics,
  PortfolioPosition,
  ProfitabilityDataPoint,
  ProfitabilityData,
  TimeRange
} from './profitability-types';

// Types for charisma-party API responses
interface BalanceMessage {
  type: 'BALANCE_UPDATE';
  userId: string;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  formattedBalance: number;
  timestamp: number;
  source: string;
  metadata?: any;
}

interface BalanceResponse {
  balances: BalanceMessage[];
  party: string;
  serverTime: number;
  initialized: boolean;
}

interface PriceUpdate {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

interface PriceResponse {
  prices: PriceUpdate[];
  party: string;
  serverTime: number;
  initialized: boolean;
}

/**
 * Get current portfolio value using charisma-party balances and prices
 */
async function getCurrentPortfolioValue(userAddress: string): Promise<{
  currentPortfolioValue: number;
  tokenBreakdown: { contractId: string; balance: number; value: number; price: number }[];
} | null> {
  try {
    const charismaPartyUrl = process.env.CHARISMA_PARTY_URL || 'http://localhost:1999';

    console.log(`[PORTFOLIO] Fetching current portfolio value from ${charismaPartyUrl}`);

    // Fetch user balances from charisma-party
    const balanceResponse = await fetch(`${charismaPartyUrl}/parties/balances/main?users=${userAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!balanceResponse.ok) {
      console.warn(`[PORTFOLIO] Failed to fetch balances: ${balanceResponse.status} ${balanceResponse.statusText}`);
      const errorText = await balanceResponse.text();
      console.warn(`[PORTFOLIO] Balance response error:`, errorText);
      return null;
    }

    const balanceData: BalanceResponse = await balanceResponse.json();
    console.log(`[PORTFOLIO] Retrieved ${balanceData.balances?.length || 0} balance entries`);

    // Fetch all current prices
    const priceResponse = await fetch(`${charismaPartyUrl}/parties/prices/main`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!priceResponse.ok) {
      console.warn(`[PORTFOLIO] Failed to fetch prices: ${priceResponse.status} ${priceResponse.statusText}`);
      const errorText = await priceResponse.text();
      console.warn(`[PORTFOLIO] Price response error:`, errorText);
      return null;
    }

    const priceData: PriceResponse = await priceResponse.json();
    console.log(`[PORTFOLIO] Retrieved ${priceData.prices?.length || 0} price entries`);

    // Create price lookup map
    const priceMap = new Map<string, number>();
    for (const priceUpdate of priceData.prices) {
      priceMap.set(priceUpdate.contractId, priceUpdate.price);
    }

    // Calculate portfolio value
    let totalValue = 0;
    const tokenBreakdown: { contractId: string; balance: number; value: number; price: number }[] = [];

    for (const balance of balanceData.balances) {
      if (balance.userId !== userAddress || balance.formattedBalance <= 0) {
        continue;
      }

      const price = priceMap.get(balance.contractId) || 0;
      const value = balance.formattedBalance * price;

      totalValue += value;

      tokenBreakdown.push({
        contractId: balance.contractId,
        balance: balance.formattedBalance,
        value,
        price
      });

      console.log(`[PORTFOLIO] ${balance.symbol}: ${balance.formattedBalance} × $${price} = $${value.toFixed(2)}`);
    }

    console.log(`[PORTFOLIO] Total current portfolio value: $${totalValue.toFixed(2)}`);

    return {
      currentPortfolioValue: totalValue,
      tokenBreakdown
    };

  } catch (error) {
    console.error(`[PORTFOLIO] Error fetching current portfolio value:`, error);
    return null;
  }
}

/**
 * Calculate portfolio-level profitability for a user
 */
export async function calculatePortfolioProfitability(
  userAddress: string,
  timeRange: TimeRange = 'ALL'
): Promise<PortfolioProfitabilityData | null> {
  try {
    console.log(`[PORTFOLIO] Calculating portfolio P&L for user: ${userAddress}`);

    // Get current portfolio value from actual token holdings
    let portfolioValue = await getCurrentPortfolioValue(userAddress);
    if (!portfolioValue) {
      console.log(`[PORTFOLIO] Unable to fetch current portfolio value for: ${userAddress}, falling back to trading activity only`);

      // Fallback: if we can't get portfolio value, still try to show trading activity data
      // Set portfolio value to 0 for now - this will show trading P&L vs 0 current value
      portfolioValue = {
        currentPortfolioValue: 0,
        tokenBreakdown: []
      };
    }

    // Get all user activities for tracking trading performance
    const result = await getUserActivityTimeline(userAddress, {
      limit: 1000, // Get all activities
      offset: 0,
      sortOrder: 'desc',
      types: ['instant_swap'], // Only include swaps for P&L calculation
      statuses: ['completed'] // Only completed activities
    });

    if (!result.activities || result.activities.length === 0) {
      console.log(`[PORTFOLIO] No completed swap activities found for user: ${userAddress}`);

      // Still return portfolio data if user has token holdings but no tracked trades
      // This will show current portfolio value even without trading history
      return {
        metrics: {
          totalPnL: {
            percentage: 0,
            usdValue: portfolioValue.currentPortfolioValue // Show current value as "gain" if no trades tracked
          },
          bestPosition: {
            activityId: '',
            percentage: 0,
            usdValue: 0,
            timestamp: Date.now()
          },
          worstPosition: {
            activityId: '',
            percentage: 0,
            usdValue: 0,
            timestamp: Date.now()
          },
          averageReturn: 0,
          totalPositions: 0,
          profitablePositions: 0,
          winRate: 0
        },
        chartData: [],
        positions: [],
        totalInvested: 0,
        currentValue: portfolioValue.currentPortfolioValue
      };
    }

    console.log(`[PORTFOLIO] Found ${result.activities.length} completed swaps for portfolio calculation`);

    // Calculate profitability for each activity in parallel with limited concurrency
    const positions: PortfolioPosition[] = [];
    let totalInvested = 0;

    const concurrency = 5;
    for (let i = 0; i < result.activities.length; i += concurrency) {
      const batch = result.activities.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async (activity) => {
          const profitabilityData = await calculateTradeProfitability(activity);
          if (!profitabilityData) {
            console.warn(`[PORTFOLIO] No profitability data for activity: ${activity.id}`);
            return null;
          }

          // Calculate original investment amount for this trade
          const originalValue = getActivityOriginalValue(activity);
          totalInvested += originalValue;

          return {
            activityId: activity.id,
            profitabilityData,
            weight: 0, // Will be calculated after we have totalInvested
            originalValue
          };
        })
      );

      // Process successful results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          positions.push({
            activityId: result.value.activityId,
            profitabilityData: result.value.profitabilityData,
            weight: totalInvested > 0 ? result.value.originalValue / totalInvested : 0
          });
        }
      }
    }

    if (positions.length === 0) {
      console.log(`[PORTFOLIO] No valid profitability data found for user: ${userAddress}`);
      return null;
    }

    // Calculate portfolio metrics using actual current portfolio value vs historical investments
    const metrics = calculatePortfolioMetrics(positions, totalInvested, portfolioValue.currentPortfolioValue);

    // Generate portfolio chart data
    const chartData = generatePortfolioChartData(positions, timeRange);

    return {
      metrics,
      chartData,
      positions,
      totalInvested,
      currentValue: portfolioValue.currentPortfolioValue
    };

  } catch (error) {
    console.error(`[PORTFOLIO] Error calculating portfolio profitability for ${userAddress}:`, error);
    return null;
  }
}

/**
 * Get the original USD value of an activity
 */
function getActivityOriginalValue(activity: ActivityItem): number {
  // Try to get from USD value if available
  if (activity.fromToken.usdValue && activity.fromToken.usdValue > 0) {
    return activity.fromToken.usdValue;
  }

  // Fallback: calculate from amount and price snapshot
  if (activity.fromToken.priceSnapshot && activity.fromToken.amount) {
    const amount = parseFloat(activity.fromToken.amount);
    const decimals = activity.fromToken.decimals || 6;
    const adjustedAmount = amount / Math.pow(10, decimals);
    return adjustedAmount * activity.fromToken.priceSnapshot.price;
  }

  // Final fallback: assume $1 for minimal calculation
  console.warn(`[PORTFOLIO] Unable to determine original value for activity ${activity.id}, using $1 fallback`);
  return 1.0;
}

/**
 * Calculate portfolio-level metrics from individual positions
 */
function calculatePortfolioMetrics(
  positions: PortfolioPosition[],
  totalInvested: number,
  currentValue: number
): PortfolioProfitabilityMetrics {
  // Portfolio P&L is now: current portfolio value vs total invested in trades
  const totalPnLUsd = currentValue - totalInvested;
  const totalPnLPercentage = totalInvested > 0 ? (totalPnLUsd / totalInvested) * 100 : 0;

  console.log(`[PORTFOLIO] Portfolio P&L: $${currentValue.toFixed(2)} current - $${totalInvested.toFixed(2)} invested = ${totalPnLPercentage.toFixed(2)}%`);

  if (positions.length === 0) {
    return {
      totalPnL: {
        percentage: totalPnLPercentage,
        usdValue: totalPnLUsd
      },
      bestPosition: {
        activityId: '',
        percentage: 0,
        usdValue: 0,
        timestamp: Date.now()
      },
      worstPosition: {
        activityId: '',
        percentage: 0,
        usdValue: 0,
        timestamp: Date.now()
      },
      averageReturn: 0,
      totalPositions: 0,
      profitablePositions: 0,
      winRate: 0
    };
  }

  // Find best and worst individual trading positions (not portfolio overall)
  let bestPosition = positions[0];
  let worstPosition = positions[0];
  let profitablePositions = 0;
  let totalReturns = 0;

  for (const position of positions) {
    const positionPnL = position.profitabilityData.metrics.currentPnL.percentage;

    if (positionPnL > bestPosition.profitabilityData.metrics.currentPnL.percentage) {
      bestPosition = position;
    }

    if (positionPnL < worstPosition.profitabilityData.metrics.currentPnL.percentage) {
      worstPosition = position;
    }

    if (positionPnL > 0) {
      profitablePositions++;
    }

    totalReturns += positionPnL;
  }

  const averageReturn = positions.length > 0 ? totalReturns / positions.length : 0;
  const winRate = positions.length > 0 ? (profitablePositions / positions.length) * 100 : 0;

  return {
    totalPnL: {
      percentage: totalPnLPercentage,
      usdValue: totalPnLUsd
    },
    bestPosition: {
      activityId: bestPosition.activityId,
      percentage: bestPosition.profitabilityData.metrics.currentPnL.percentage,
      usdValue: bestPosition.profitabilityData.metrics.currentPnL.usdValue,
      timestamp: bestPosition.profitabilityData.metrics.bestPerformance.timestamp
    },
    worstPosition: {
      activityId: worstPosition.activityId,
      percentage: worstPosition.profitabilityData.metrics.currentPnL.percentage,
      usdValue: worstPosition.profitabilityData.metrics.currentPnL.usdValue,
      timestamp: worstPosition.profitabilityData.metrics.worstPerformance.timestamp
    },
    averageReturn,
    totalPositions: positions.length,
    profitablePositions,
    winRate
  };
}

/**
 * Generate portfolio-level chart data by aggregating individual position data
 */
function generatePortfolioChartData(
  positions: PortfolioPosition[],
  timeRange: TimeRange
): ProfitabilityDataPoint[] {
  // Collect all unique timestamps from all positions
  const allTimestamps = new Set<number>();

  for (const position of positions) {
    for (const point of position.profitabilityData.chartData) {
      allTimestamps.add(point.time);
    }
  }

  // Apply time range filter
  const filteredTimestamps = Array.from(allTimestamps)
    .sort((a, b) => a - b)
    .filter(timestamp => {
      if (timeRange === 'ALL') return true;

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
          return true;
      }

      return timestamp >= cutoffTime;
    });

  // Generate portfolio chart points
  const portfolioChartData: ProfitabilityDataPoint[] = [];

  for (const timestamp of filteredTimestamps) {
    let totalPortfolioValue = 0;
    let totalOriginalValue = 0;

    // For each position, find the closest data point to this timestamp
    for (const position of positions) {
      const originalValue = position.weight * getTotalInvestedFromPositions(positions);
      totalOriginalValue += originalValue;

      // Find closest chart data point for this timestamp
      const closestPoint = findClosestChartPoint(position.profitabilityData.chartData, timestamp);
      if (closestPoint) {
        // Calculate position value at this timestamp
        const positionPnLUsd = (closestPoint.value / 100) * originalValue;
        const positionValue = originalValue + positionPnLUsd;
        totalPortfolioValue += positionValue;
      } else {
        // Fallback to original value if no chart data
        totalPortfolioValue += originalValue;
      }
    }

    // Calculate portfolio P&L for this timestamp
    const portfolioPnLUsd = totalPortfolioValue - totalOriginalValue;
    const portfolioPnLPercentage = totalOriginalValue > 0 ? (portfolioPnLUsd / totalOriginalValue) * 100 : 0;

    portfolioChartData.push({
      time: timestamp,
      value: Number(portfolioPnLPercentage.toFixed(2)),
      usdValue: Number(portfolioPnLUsd.toFixed(2))
    });
  }

  return portfolioChartData;
}

/**
 * Find the closest chart data point to a given timestamp
 */
function findClosestChartPoint(chartData: ProfitabilityDataPoint[], targetTimestamp: number): ProfitabilityDataPoint | null {
  if (chartData.length === 0) return null;

  let closest = chartData[0];
  let minDiff = Math.abs(targetTimestamp - closest.time);

  for (const point of chartData) {
    const diff = Math.abs(targetTimestamp - point.time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
}

/**
 * Calculate total invested amount from positions (helper function)
 */
function getTotalInvestedFromPositions(positions: PortfolioPosition[]): number {
  // This is a bit circular, but we need it for weight calculations
  // In practice, this would be calculated once and passed around
  return positions.reduce((total, position) => {
    // Estimate original value from current weight (this is approximate)
    return total + (position.weight > 0 ? 100 / position.weight : 100);
  }, 0);
}