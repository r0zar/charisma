/**
 * Portfolio-level profitability calculation service
 * Aggregates individual activity P&L data into portfolio totals
 */

import { ActivityItem } from './activity-types';
import { getUserActivityTimeline } from './activity-storage';
import { calculateTradeProfitability } from './profitability-service';
import { getTokenMetadataCached } from '@repo/tokens';
import {
  PortfolioProfitabilityData,
  PortfolioProfitabilityMetrics,
  PortfolioPosition,
  PortfolioOverview,
  TradingPerformance,
  TopHolding,
  ProfitabilityDataPoint,
  ProfitabilityData,
  TimeRange
} from './profitability-types';

// Types for charisma-party API responses (normalized format)
interface BalanceResponse {
  balances: Record<string, number>; // contractId -> balance (formatted units)
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
 * Get current portfolio data using charisma-party balances and prices
 */
async function getCurrentPortfolioData(userAddress: string): Promise<{
  currentPortfolioValue: number;
  topHoldings: TopHolding[];
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
    console.log(`[PORTFOLIO] Retrieved ${Object.keys(balanceData.balances).length} balance entries`);

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

    // Calculate portfolio value from normalized balance format
    let totalValue = 0;
    const tokenBreakdown: { contractId: string; balance: number; value: number; price: number }[] = [];

    for (const [contractId, formattedBalance] of Object.entries(balanceData.balances)) {
      if (formattedBalance <= 0) {
        continue;
      }

      const price = priceMap.get(contractId) || 0;
      const value = formattedBalance * price;

      totalValue += value;

      tokenBreakdown.push({
        contractId,
        balance: formattedBalance,
        value,
        price
      });

      console.log(`[PORTFOLIO] ${contractId}: ${formattedBalance.toFixed(6)} × $${price} = $${value.toFixed(2)}`);
    }

    console.log(`[PORTFOLIO] Total current portfolio value: $${totalValue.toFixed(2)}`);

    // Sort tokens by value and get top 5 holdings
    const sortedTokens = tokenBreakdown
      .filter(token => token.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Enrich top holdings with token metadata
    const topHoldings: TopHolding[] = await Promise.all(
      sortedTokens.map(async (token) => {
        try {
          // Fetch token metadata from cache
          const tokenMetadata = await getTokenMetadataCached(token.contractId);
          
          // Extract symbol from contract ID as fallback
          const fallbackSymbol = token.contractId.includes('.') 
            ? token.contractId.split('.')[1]?.toUpperCase().replace(/-/g, '') || 'UNKNOWN'
            : token.contractId.toUpperCase();

          return {
            contractId: token.contractId,
            symbol: tokenMetadata?.symbol || fallbackSymbol,
            name: tokenMetadata?.name,
            image: tokenMetadata?.image || undefined,
            balance: token.balance,
            value: token.value,
            price: token.price,
            percentageOfPortfolio: totalValue > 0 ? (token.value / totalValue) * 100 : 0,
            decimals: tokenMetadata?.decimals,
            type: token.contractId.includes('subnet') ? 'SUBNET' as const : 'BASE' as const
          };
        } catch (error) {
          console.warn(`[PORTFOLIO] Failed to fetch metadata for ${token.contractId}:`, error);
          
          // Fallback to basic token info
          const fallbackSymbol = token.contractId.includes('.') 
            ? token.contractId.split('.')[1]?.toUpperCase().replace(/-/g, '') || 'UNKNOWN'
            : token.contractId.toUpperCase();

          return {
            contractId: token.contractId,
            symbol: fallbackSymbol,
            balance: token.balance,
            value: token.value,
            price: token.price,
            percentageOfPortfolio: totalValue > 0 ? (token.value / totalValue) * 100 : 0,
            type: token.contractId.includes('subnet') ? 'SUBNET' as const : 'BASE' as const
          };
        }
      })
    );

    return {
      currentPortfolioValue: totalValue,
      topHoldings,
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

    // Get current portfolio data from actual token holdings
    let portfolioData = await getCurrentPortfolioData(userAddress);
    if (!portfolioData) {
      console.log(`[PORTFOLIO] Unable to fetch current portfolio data for: ${userAddress}, falling back to trading activity only`);

      // Fallback: if we can't get portfolio data, still try to show trading activity data
      portfolioData = {
        currentPortfolioValue: 0,
        topHoldings: [],
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
      return {
        portfolio: {
          currentValue: portfolioData.currentPortfolioValue,
          change24h: {
            percentage: 0, // TODO: Calculate 24h change
            usdValue: 0
          },
          topHoldings: portfolioData.topHoldings
        },
        trading: {
          tradingVolume: 0,
          metrics: {
            tradingPnL: {
              percentage: 0,
              usdValue: 0
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
          positions: []
        },
        chartData: [],
        // Legacy compatibility
        totalInvested: 0,
        currentValue: portfolioData.currentPortfolioValue
      };
    }

    console.log(`[PORTFOLIO] Found ${result.activities.length} completed swaps for portfolio calculation`);

    // Calculate profitability for each activity in parallel with limited concurrency
    const positions: PortfolioPosition[] = [];
    let tradingVolume = 0;

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

          // Calculate original trading volume for this trade
          const originalValue = getActivityOriginalValue(activity);
          tradingVolume += originalValue;

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
            weight: tradingVolume > 0 ? result.value.originalValue / tradingVolume : 0
          });
        }
      }
    }

    if (positions.length === 0) {
      console.log(`[PORTFOLIO] No valid profitability data found for user: ${userAddress}`);
      return null;
    }

    // Calculate trading metrics (only from tracked trades)
    const tradingMetrics = calculateTradingMetrics(positions, tradingVolume);

    // Generate portfolio chart data
    const chartData = generatePortfolioChartData(positions, timeRange, tradingVolume);

    return {
      portfolio: {
        currentValue: portfolioData.currentPortfolioValue,
        change24h: {
          percentage: 0, // TODO: Calculate 24h change
          usdValue: 0
        },
        topHoldings: portfolioData.topHoldings
      },
      trading: {
        tradingVolume,
        metrics: tradingMetrics,
        positions
      },
      chartData,
      // Legacy compatibility
      totalInvested: tradingVolume,
      currentValue: portfolioData.currentPortfolioValue,
      metrics: tradingMetrics
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
 * Calculate trading-level metrics from individual trade positions
 */
function calculateTradingMetrics(
  positions: PortfolioPosition[],
  tradingVolume: number
): PortfolioProfitabilityMetrics {
  // Trading P&L: sum of individual trade P&L vs trading volume
  const tradingPnLUsd = positions.reduce((sum, position) => 
    sum + position.profitabilityData.metrics.currentPnL.usdValue, 0);
  const tradingPnLPercentage = tradingVolume > 0 ? (tradingPnLUsd / tradingVolume) * 100 : 0;

  console.log(`[TRADING] Trading P&L: $${tradingPnLUsd.toFixed(2)} profit from $${tradingVolume.toFixed(2)} volume = ${tradingPnLPercentage.toFixed(2)}%`);

  if (positions.length === 0) {
    return {
      tradingPnL: {
        percentage: tradingPnLPercentage,
        usdValue: tradingPnLUsd
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
    tradingPnL: {
      percentage: tradingPnLPercentage,
      usdValue: tradingPnLUsd
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
  timeRange: TimeRange,
  tradingVolume: number = 0
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
      const originalValue = position.weight * (tradingVolume || 1); // Use trading volume directly
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