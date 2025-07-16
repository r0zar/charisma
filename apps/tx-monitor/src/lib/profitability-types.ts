/**
 * Types for trade profitability tracking and calculation
 */

export interface ProfitabilityMetrics {
  currentPnL: {
    percentage: number;
    usdValue: number;
  };
  bestPerformance: {
    percentage: number;
    usdValue: number;
    timestamp: number;
  };
  worstPerformance: {
    percentage: number;
    usdValue: number;
    timestamp: number;
  };
  averageReturn: number;
  timeHeld: number; // milliseconds since trade
}

export interface ProfitabilityDataPoint {
  time: number; // Unix timestamp
  value: number; // P&L percentage
  usdValue: number; // P&L in USD
}

export interface ProfitabilityData {
  metrics: ProfitabilityMetrics;
  chartData: ProfitabilityDataPoint[];
  tokenBreakdown: {
    inputTokenChange: number; // percentage change in input token value
    outputTokenChange: number; // percentage change in output token value
    netEffect: number; // combined effect on trade value
  };
}

export type TimeRange = '1H' | '24H' | '7D' | '30D' | 'ALL';

export interface ProfitabilityCalculationInput {
  activityId: string;
  entryPrices: {
    inputToken: number;
    outputToken: number;
  };
  amounts: {
    inputAmount: number;
    outputAmount: number;
  };
  tradeTimestamp: number;
  tokenContracts: {
    inputContractId: string;
    outputContractId: string;
  };
}

export interface CurrentPriceData {
  contractId: string;
  price: number;
  timestamp: number;
  source: string;
}

export interface HistoricalPricePoint {
  timestamp: number;
  price: number;
  source: string;
}

/**
 * Portfolio-level profitability types
 */
export interface PortfolioProfitabilityMetrics {
  totalPnL: {
    percentage: number;
    usdValue: number;
  };
  bestPosition: {
    activityId: string;
    percentage: number;
    usdValue: number;
    timestamp: number;
  };
  worstPosition: {
    activityId: string;
    percentage: number;
    usdValue: number;
    timestamp: number;
  };
  averageReturn: number;
  totalPositions: number;
  profitablePositions: number;
  winRate: number; // percentage of profitable positions
}

export interface PortfolioPosition {
  activityId: string;
  profitabilityData: ProfitabilityData;
  weight: number; // position size as percentage of total portfolio
}

export interface PortfolioProfitabilityData {
  metrics: PortfolioProfitabilityMetrics;
  chartData: ProfitabilityDataPoint[];
  positions: PortfolioPosition[];
  totalInvested: number; // total USD value invested
  currentValue: number; // current USD value of portfolio
}