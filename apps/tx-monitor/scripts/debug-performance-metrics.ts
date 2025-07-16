/**
 * Debug the performance metrics calculation logic
 */

import { logger } from './logger';
import { getActivity } from '../src/lib/activity-storage';

async function debugPerformanceMetrics() {
  logger.info('Debugging performance metrics inconsistency');

  try {
    // Test a specific activity showing the inconsistency
    const activityId = '6392b34b-b611-4dbc-b075-49cbf8470e27'; // This one showed +5.2% current vs lower best
    
    // Get full profitability data
    const response = await fetch(`http://localhost:3012/api/v1/activities/${activityId}/profitability`);
    const data = await response.json();
    
    if (!data.success) {
      logger.error('Failed to get profitability data', { error: data.error });
      return;
    }

    const metrics = data.data.metrics;
    const chartData = data.data.chartData;

    logger.info('Performance Metrics Analysis', {
      currentPnL: `${metrics.currentPnL.percentage.toFixed(2)}%`,
      bestPerformance: `${metrics.bestPerformance.percentage.toFixed(2)}%`,
      worstPerformance: `${metrics.worstPerformance.percentage.toFixed(2)}%`,
      averageReturn: `${metrics.averageReturn.toFixed(2)}%`,
      chartDataPoints: chartData.length
    });

    // Check if current P&L is logically consistent
    const currentBetterThanBest = metrics.currentPnL.percentage > metrics.bestPerformance.percentage;
    const currentWorseThanWorst = metrics.currentPnL.percentage < metrics.worstPerformance.percentage;

    logger.warn('Logic Check', {
      currentBetterThanBest: currentBetterThanBest ? '🚨 INCONSISTENT' : '✅ OK',
      currentWorseThanWorst: currentWorseThanWorst ? '🚨 INCONSISTENT' : '✅ OK',
      problem: currentBetterThanBest ? 
        'Current P&L cannot be better than historical best' : 
        'Logic is consistent'
    });

    // Analyze chart data to see what's happening
    logger.info('Chart Data Analysis', {
      chartPoints: chartData.map((point, index) => ({
        point: index + 1,
        time: new Date(point.time * 1000).toLocaleString(),
        value: `${point.value}%`,
        usdValue: `$${point.usdValue.toFixed(4)}`
      }))
    });

    // Find the actual best and worst from chart data
    const chartValues = chartData.map(p => p.value);
    const actualBest = Math.max(...chartValues);
    const actualWorst = Math.min(...chartValues);
    const currentValue = chartData[chartData.length - 1]?.value || 0;

    logger.info('Chart vs Metrics Comparison', {
      chartActualBest: `${actualBest.toFixed(2)}%`,
      chartActualWorst: `${actualWorst.toFixed(2)}%`,
      chartCurrentValue: `${currentValue.toFixed(2)}%`,
      metricsReportedBest: `${metrics.bestPerformance.percentage.toFixed(2)}%`,
      metricsReportedWorst: `${metrics.worstPerformance.percentage.toFixed(2)}%`,
      metricsReportedCurrent: `${metrics.currentPnL.percentage.toFixed(2)}%`,
      issue: actualBest !== metrics.bestPerformance.percentage ? 
        'Metrics calculation is wrong' : 
        'Metrics match chart data'
    });

  } catch (error) {
    logger.error('Debug failed', { error: error.message });
  }
}

debugPerformanceMetrics().then(() => {
  logger.info('Performance metrics debug completed');
}).catch(error => {
  logger.error('Debug script failed', { error: error.message });
});