#!/usr/bin/env node

/**
 * Debugging script to test the complete dashboard data flow
 * Usage: pnpm script scripts/test-dashboard-data-flow.ts
 */

import { logger } from './logger';
import { getQueueStats, getMetricsHistory } from '../src/lib/transaction-monitor';
import { getActivityStats } from '../src/lib/activity-storage';
import type { QueueStatsResponse, MetricsHistoryResponse } from '../src/lib/types';

// Calculate appropriate time range based on oldest transaction and activity data
function calculateTimeRange(oldestTransactionAge?: number, oldestActivityAge?: number): number {
  // Find the oldest data point between transactions and activities
  const ages = [oldestTransactionAge, oldestActivityAge].filter((age): age is number => age !== undefined);
  
  if (ages.length === 0) return 24; // Default to 24 hours
  
  const oldestAge = Math.max(...ages);
  const ageInHours = Math.ceil(oldestAge / (60 * 60 * 1000));
  
  // Add some buffer and cap at 7 days max
  const bufferedHours = Math.min(ageInHours + 2, 168);
  
  // More responsive minimum - use actual age if over 1 hour, otherwise 24 hours
  const minHours = ageInHours > 1 ? Math.max(ageInHours + 2, 6) : 24;
  
  const finalHours = Math.max(bufferedHours, minHours);
  
  return finalHours;
}

// Transform metrics data for charts (copied from dashboard)
function transformMetricsForCharts(metrics: MetricsHistoryResponse) {
  return metrics.metrics.map(metric => {
    const date = new Date(metric.timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Show more detailed time formatting
    const timeFormat = isToday 
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    
    return {
      time: timeFormat,
      // Transaction metrics
      queueSize: metric.queueSize,
      processed: metric.processed,
      successful: metric.successful,
      failed: metric.failed,
      // Activity metrics
      activityCompleted: metric.activities?.completed || 0,
      activityPending: metric.activities?.pending || 0,
      activityFailed: metric.activities?.failed || 0,
      activityCancelled: metric.activities?.cancelled || 0,
      activityProcessing: metric.activities?.processing || 0
    };
  });
}

// Simulate fetching functions from dashboard
async function fetchQueueStats(): Promise<QueueStatsResponse> {
  return await getQueueStats();
}

async function fetchActivityStats(): Promise<any> {
  return await getActivityStats();
}

async function fetchMetricsHistory(hours: number): Promise<MetricsHistoryResponse> {
  return await getMetricsHistory(hours);
}

async function testDashboardDataFlow() {
  await logger.info('🎛️ Starting dashboard data flow test');
  
  try {
    // Step 1: Simulate the dashboard loading process
    await logger.info('📊 Step 1: Fetching initial stats...');
    
    const [statsData, activityData] = await Promise.all([
      fetchQueueStats(),
      fetchActivityStats().catch(() => null)
    ]);
    
    await logger.info(`📊 Initial Stats:
      📈 Queue Size: ${statsData.queueSize}
      📈 Total Processed: ${statsData.totalProcessed}
      🕒 Oldest Transaction Age: ${statsData.oldestTransactionAge ? `${Math.round(statsData.oldestTransactionAge / (60 * 1000))} minutes` : 'N/A'}
      
      📊 Activity Stats:
      📈 Total Activities: ${activityData?.total || 0}
      🕒 Oldest Activity Age: ${activityData?.oldestActivityAge ? `${Math.round(activityData.oldestActivityAge / (60 * 1000))} minutes` : 'N/A'}`);
    
    // Step 2: Calculate time range (dashboard logic)
    await logger.info('🕒 Step 2: Calculating time range...');
    
    const timeRange = calculateTimeRange(
      statsData.oldestTransactionAge,
      activityData?.oldestActivityAge
    );
    
    await logger.info(`🕒 Time Range Calculation:
      📊 Oldest Transaction Age: ${statsData.oldestTransactionAge ? `${Math.round(statsData.oldestTransactionAge / (60 * 1000))} minutes` : 'N/A'}
      📊 Oldest Activity Age: ${activityData?.oldestActivityAge ? `${Math.round(activityData.oldestActivityAge / (60 * 1000))} minutes` : 'N/A'}
      📊 Calculated Time Range: ${timeRange} hours`);
    
    // Step 3: Fetch metrics history with calculated time range
    await logger.info('📈 Step 3: Fetching metrics history...');
    
    const metricsData = await fetchMetricsHistory(timeRange);
    
    await logger.info(`📈 Metrics History:
      📊 Period: ${metricsData.period}
      📊 Total Records: ${metricsData.total}
      📊 Array Length: ${metricsData.metrics.length}`);
    
    // Step 4: Transform data for charts
    await logger.info('🎨 Step 4: Transforming data for charts...');
    
    const chartData = transformMetricsForCharts(metricsData);
    
    await logger.info(`🎨 Chart Data:
      📊 Transformed Records: ${chartData.length}
      🕒 First Time: ${chartData[0]?.time || 'N/A'}
      🕒 Last Time: ${chartData[chartData.length - 1]?.time || 'N/A'}`);
    
    // Step 5: Analyze chart data for dashboard display
    await logger.info('🔍 Step 5: Analyzing chart data...');
    
    if (chartData.length === 0) {
      await logger.error('❌ No chart data available - charts will be empty!');
      return;
    }
    
    // Calculate totals for each metric
    const totals = chartData.reduce((acc, point) => ({
      queueSize: acc.queueSize + point.queueSize,
      processed: acc.processed + point.processed,
      successful: acc.successful + point.successful,
      failed: acc.failed + point.failed,
      activityCompleted: acc.activityCompleted + point.activityCompleted,
      activityPending: acc.activityPending + point.activityPending,
      activityFailed: acc.activityFailed + point.activityFailed,
      activityCancelled: acc.activityCancelled + point.activityCancelled,
      activityProcessing: acc.activityProcessing + point.activityProcessing
    }), {
      queueSize: 0, processed: 0, successful: 0, failed: 0,
      activityCompleted: 0, activityPending: 0, activityFailed: 0,
      activityCancelled: 0, activityProcessing: 0
    });
    
    await logger.info(`📊 Chart Data Analysis:
      📈 Transaction Totals:
      📊 Queue Size Sum: ${totals.queueSize}
      📊 Processed Sum: ${totals.processed}
      ✅ Successful Sum: ${totals.successful}
      ❌ Failed Sum: ${totals.failed}
      
      📈 Activity Totals:
      ✅ Completed Sum: ${totals.activityCompleted}
      🕒 Pending Sum: ${totals.activityPending}
      ❌ Failed Sum: ${totals.activityFailed}
      🚫 Cancelled Sum: ${totals.activityCancelled}
      🔄 Processing Sum: ${totals.activityProcessing}`);
    
    // Step 6: Check for chart display issues
    await logger.info('🔍 Step 6: Checking for chart display issues...');
    
    // Check if all activity metrics are zero
    const allActivityZero = Object.values(totals).slice(4).every(val => val === 0);
    
    if (allActivityZero) {
      await logger.error('❌ All activity metrics are zero - activity chart will be empty!');
    } else {
      await logger.success('✅ Activity metrics contain data');
    }
    
    // Check if all transaction metrics are zero
    const allTransactionZero = [totals.processed, totals.successful, totals.failed].every(val => val === 0);
    
    if (allTransactionZero) {
      await logger.warn('⚠️ All transaction processing metrics are zero - only queue size will show');
    } else {
      await logger.success('✅ Transaction metrics contain data');
    }
    
    // Step 7: Test different time ranges
    await logger.info('🕒 Step 7: Testing different time ranges...');
    
    const testRanges = [6, 24, 48];
    
    for (const hours of testRanges) {
      try {
        const testMetrics = await fetchMetricsHistory(hours);
        const testChartData = transformMetricsForCharts(testMetrics);
        
        const nonZeroActivity = testChartData.filter(point => 
          point.activityCompleted > 0 || point.activityPending > 0 || 
          point.activityFailed > 0 || point.activityCancelled > 0 || 
          point.activityProcessing > 0
        ).length;
        
        await logger.info(`📊 ${hours}h range: ${testMetrics.metrics.length} records, ${nonZeroActivity} with activity data`);
        
      } catch (error) {
        await logger.error(`❌ Error testing ${hours}h range: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Step 8: Final dashboard simulation
    await logger.info('🎛️ Step 8: Final dashboard simulation...');
    
    const dashboardData = {
      stats: statsData,
      metrics: metricsData,
      activityStats: activityData,
      chartData: chartData,
      timeRange: timeRange
    };
    
    await logger.info(`🎛️ Dashboard Data Summary:
      📊 Queue Size: ${dashboardData.stats.queueSize}
      📊 Processing Health: ${dashboardData.stats.processingHealth}
      📊 Success Rate: ${dashboardData.stats.totalProcessed > 0 ? ((dashboardData.stats.totalSuccessful / dashboardData.stats.totalProcessed) * 100).toFixed(1) : 0}%
      📊 Chart Time Range: ${dashboardData.timeRange}h
      📊 Chart Data Points: ${dashboardData.chartData.length}
      📊 Activity Data Available: ${dashboardData.activityStats ? 'Yes' : 'No'}`);
    
    await logger.success('✅ Dashboard data flow test completed');
    
    // Step 9: Recommendations
    await logger.info('💡 Step 9: Recommendations...');
    
    if (allActivityZero) {
      await logger.warn('💡 Recommendation: Check if activity metrics are being stored in MetricsSnapshot');
    }
    
    if (timeRange === 24) {
      await logger.info('💡 Info: Using default 24-hour time range');
    } else {
      await logger.info(`💡 Info: Using dynamic ${timeRange}-hour time range based on data age`);
    }
    
    if (chartData.length < 6) {
      await logger.warn('💡 Recommendation: Consider increasing metrics collection frequency for better charts');
    }
    
  } catch (error) {
    await logger.error(`❌ Dashboard data flow test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the test
testDashboardDataFlow().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});