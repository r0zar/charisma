/**
 * Types for trade profitability tracking and visualization
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

export interface MockProfitabilityScenarios {
  profitable: ProfitabilityData;
  loss: ProfitabilityData;
  volatile: ProfitabilityData;
  breakeven: ProfitabilityData;
}

export type TimeRange = '1H' | '24H' | '7D' | '30D' | 'ALL';

export interface ProfitabilityChartProps {
  data: ProfitabilityData;
  timeRange: TimeRange;
  height?: number;
  showControls?: boolean;
  miniMode?: boolean;
}