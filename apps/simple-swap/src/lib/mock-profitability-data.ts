/**
 * Mock profitability data for UI development
 * Generates realistic scenarios for different trade outcomes
 */

import { ProfitabilityData, MockProfitabilityScenarios, ProfitabilityDataPoint } from '@/types/profitability';

// Helper function to generate chart data points
function generateChartData(
  baseTimestamp: number,
  durationHours: number,
  startValue: number,
  endValue: number,
  volatility: number = 0.1,
  points: number = 50
): ProfitabilityDataPoint[] {
  const data: ProfitabilityDataPoint[] = [];
  const stepSize = (durationHours * 60 * 60 * 1000) / points;
  const valueDiff = endValue - startValue;
  
  for (let i = 0; i <= points; i++) {
    const timestamp = baseTimestamp + (i * stepSize);
    const progress = i / points;
    
    // Base trend line
    let value = startValue + (valueDiff * progress);
    
    // Add volatility (random walks)
    if (i > 0) {
      const randomChange = (Math.random() - 0.5) * volatility * 2;
      value += randomChange;
    }
    
    // Simulate realistic price movements
    if (i > 0 && i < points - 5) {
      // Add some realistic market movements
      const marketCycle = Math.sin((progress * Math.PI * 3)) * volatility * 0.5;
      value += marketCycle;
    }
    
    // Convert percentage to USD value (assuming $300 original trade value)
    const originalTradeValue = 300;
    const usdValue = (value / 100) * originalTradeValue;
    
    data.push({
      time: Math.floor(timestamp / 1000),
      value: Number(value.toFixed(2)),
      usdValue: Number(usdValue.toFixed(2))
    });
  }
  
  return data;
}

// Generate mock scenarios
export const mockProfitabilityScenarios: MockProfitabilityScenarios = {
  profitable: {
    metrics: {
      currentPnL: {
        percentage: 15.3,
        usdValue: 45.90
      },
      bestPerformance: {
        percentage: 22.1,
        usdValue: 66.30,
        timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      worstPerformance: {
        percentage: -2.3,
        usdValue: -6.90,
        timestamp: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      averageReturn: 8.7,
      timeHeld: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    chartData: generateChartData(
      Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
      7 * 24, // 7 days duration
      0, // start at breakeven
      15.3, // end at +15.3%
      3 // moderate volatility
    ),
    tokenBreakdown: {
      inputTokenChange: -2.1, // aeUSDC slightly down
      outputTokenChange: 18.9, // CHA up significantly
      netEffect: 15.3 // combined positive effect
    }
  },

  loss: {
    metrics: {
      currentPnL: {
        percentage: -8.2,
        usdValue: -24.60
      },
      bestPerformance: {
        percentage: 5.1,
        usdValue: 15.30,
        timestamp: Date.now() - (6 * 24 * 60 * 60 * 1000) // 6 days ago
      },
      worstPerformance: {
        percentage: -12.8,
        usdValue: -38.40,
        timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
      },
      averageReturn: -3.4,
      timeHeld: 10 * 24 * 60 * 60 * 1000 // 10 days
    },
    chartData: generateChartData(
      Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
      10 * 24, // 10 days duration
      0, // start at breakeven
      -8.2, // end at -8.2%
      4 // higher volatility for loss scenario
    ),
    tokenBreakdown: {
      inputTokenChange: 1.2, // aeUSDC slightly up
      outputTokenChange: -10.1, // CHA down significantly
      netEffect: -8.2 // combined negative effect
    }
  },

  volatile: {
    metrics: {
      currentPnL: {
        percentage: 3.1,
        usdValue: 9.30
      },
      bestPerformance: {
        percentage: 28.7,
        usdValue: 86.10,
        timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days ago
      },
      worstPerformance: {
        percentage: -15.4,
        usdValue: -46.20,
        timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
      },
      averageReturn: 6.8,
      timeHeld: 14 * 24 * 60 * 60 * 1000 // 14 days
    },
    chartData: generateChartData(
      Date.now() - (14 * 24 * 60 * 60 * 1000), // 14 days ago
      14 * 24, // 14 days duration
      0, // start at breakeven
      3.1, // end at +3.1%
      8 // high volatility
    ),
    tokenBreakdown: {
      inputTokenChange: -0.8, // aeUSDC slightly down
      outputTokenChange: 4.2, // CHA moderately up
      netEffect: 3.1 // small positive effect after volatility
    }
  },

  breakeven: {
    metrics: {
      currentPnL: {
        percentage: 0.2,
        usdValue: 0.60
      },
      bestPerformance: {
        percentage: 7.3,
        usdValue: 21.90,
        timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      worstPerformance: {
        percentage: -4.1,
        usdValue: -12.30,
        timestamp: Date.now() - (4 * 24 * 60 * 60 * 1000) // 4 days ago
      },
      averageReturn: 1.2,
      timeHeld: 5 * 24 * 60 * 60 * 1000 // 5 days
    },
    chartData: generateChartData(
      Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days ago
      5 * 24, // 5 days duration
      0, // start at breakeven
      0.2, // end near breakeven
      2 // low volatility
    ),
    tokenBreakdown: {
      inputTokenChange: 0.5, // aeUSDC slightly up
      outputTokenChange: -0.4, // CHA slightly down
      netEffect: 0.2 // nearly breakeven
    }
  }
};

// Helper function to get mock data for a specific activity
export function getMockProfitabilityData(activityId: string): ProfitabilityData {
  // Use activity ID to deterministically assign scenario
  const hash = activityId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const scenarios = Object.values(mockProfitabilityScenarios);
  const index = Math.abs(hash) % scenarios.length;
  
  return scenarios[index];
}

// Helper function to filter chart data by time range
export function filterDataByTimeRange(
  data: ProfitabilityDataPoint[],
  timeRange: string
): ProfitabilityDataPoint[] {
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
      return data; // Return all data for 'ALL'
  }
  
  return data.filter(point => point.time >= cutoffTime);
}