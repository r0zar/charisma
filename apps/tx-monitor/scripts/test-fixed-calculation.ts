/**
 * Test the fixed profitability calculation
 */

import { logger } from './logger';
import { calculateTradeProfitability } from '../src/lib/profitability-service';
import { getActivity } from '../src/lib/activity-storage';

async function testFixedCalculation() {
  logger.info('Testing fixed profitability calculation');

  try {
    const activityId = 'a970bbc2-3750-42fd-bd25-92bf65b2f046';
    const activity = await getActivity(activityId);
    
    if (!activity) {
      logger.error('Activity not found', { activityId });
      return;
    }

    logger.info('Testing activity', {
      id: activity.id,
      fromToken: `${activity.fromToken.amount} ${activity.fromToken.symbol}`,
      toToken: `${activity.toToken.amount} ${activity.toToken.symbol}`
    });

    const result = await calculateTradeProfitability(activity);
    
    if (result) {
      logger.info('Profitability calculation result', {
        currentPnL: `${result.metrics.currentPnL.percentage.toFixed(2)}% ($${result.metrics.currentPnL.usdValue.toFixed(4)})`,
        bestPerformance: `${result.metrics.bestPerformance.percentage.toFixed(2)}%`,
        worstPerformance: `${result.metrics.worstPerformance.percentage.toFixed(2)}%`,
        chartDataPoints: result.chartData.length,
        tokenBreakdown: {
          inputTokenChange: `${result.tokenBreakdown.inputTokenChange.toFixed(2)}%`,
          outputTokenChange: `${result.tokenBreakdown.outputTokenChange.toFixed(2)}%`,
          netEffect: `${result.tokenBreakdown.netEffect.toFixed(2)}%`
        }
      });

      // Check if the chart data still shows impossible gains
      const maxGain = Math.max(...result.chartData.map(p => p.value));
      const minLoss = Math.min(...result.chartData.map(p => p.value));
      
      logger.info('Chart data analysis', {
        maxGain: `${maxGain.toFixed(2)}%`,
        minLoss: `${minLoss.toFixed(2)}%`,
        isRealistic: maxGain < 50 && maxGain > -95 ? 'Yes' : 'No - still showing impossible values'
      });

    } else {
      logger.error('Profitability calculation returned null');
    }

  } catch (error) {
    logger.error('Test failed', { error: error.message });
  }
}

testFixedCalculation().then(() => {
  logger.info('Test completed');
}).catch(error => {
  logger.error('Test script failed', { error: error.message });
});