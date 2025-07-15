#!/usr/bin/env node

/**
 * Debugging script to validate chart data transformation
 * Usage: pnpm script scripts/validate-chart-data.ts
 */

import { logger } from './logger';
import { getMetricsHistory } from '../src/lib/transaction-monitor';
import type { MetricsHistoryResponse } from '../src/lib/types';

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

async function validateChartData() {
  await logger.info('📊 Starting chart data validation');
  
  try {
    // Test different time ranges
    const timeRanges = [6, 24, 48];
    
    for (const hours of timeRanges) {
      await logger.info(`🕒 Testing ${hours}h time range...`);
      
      try {
        // Get metrics history
        const metricsHistory = await getMetricsHistory(hours);
        
        await logger.info(`📊 Raw Metrics History (${hours}h):
          📋 Total Records: ${metricsHistory.total}
          🕒 Period: ${metricsHistory.period}
          📊 Array Length: ${metricsHistory.metrics.length}`);
        
        if (metricsHistory.metrics.length === 0) {
          await logger.warn(`⚠️ No metrics data for ${hours}h range`);
          continue;
        }
        
        // Transform the data
        const chartData = transformMetricsForCharts(metricsHistory);
        
        await logger.info(`📊 Transformed Chart Data:
          📋 Chart Records: ${chartData.length}
          🕒 First Time: ${chartData[0]?.time || 'N/A'}
          🕒 Last Time: ${chartData[chartData.length - 1]?.time || 'N/A'}`);
        
        // Validate chart data structure
        const sampleIndex = Math.floor(chartData.length / 2);
        const sample = chartData[sampleIndex];
        
        if (!sample) {
          await logger.error('❌ No sample data available');
          continue;
        }
        
        await logger.info(`📋 Sample Chart Data Point:
          🕒 Time: ${sample.time}
          
          📊 Transaction Metrics:
          📈 Queue Size: ${sample.queueSize}
          📈 Processed: ${sample.processed}
          ✅ Successful: ${sample.successful}
          ❌ Failed: ${sample.failed}
          
          📊 Activity Metrics:
          ✅ Completed: ${sample.activityCompleted}
          🕒 Pending: ${sample.activityPending}
          ❌ Failed: ${sample.activityFailed}
          🚫 Cancelled: ${sample.activityCancelled}
          🔄 Processing: ${sample.activityProcessing}`);
        
        // Check for missing or invalid data
        await validateChartDataPoint(sample, hours);
        
        // Check for data consistency across all points
        await validateDataConsistency(chartData, hours);
        
        await logger.success(`✅ ${hours}h chart data validation completed`);
        
      } catch (error) {
        await logger.error(`❌ ${hours}h chart data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    await logger.success('✅ Chart data validation completed');
    
  } catch (error) {
    await logger.error(`❌ Chart data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function validateChartDataPoint(sample: any, hours: number) {
  const requiredFields = [
    'time', 'queueSize', 'processed', 'successful', 'failed',
    'activityCompleted', 'activityPending', 'activityFailed', 'activityCancelled', 'activityProcessing'
  ];
  
  const missing = requiredFields.filter(field => !(field in sample));
  
  if (missing.length > 0) {
    await logger.error(`❌ Missing chart data fields: ${missing.join(', ')}`);
  } else {
    await logger.success(`✅ All required chart data fields present`);
  }
  
  // Check for null/undefined values
  const nullFields = requiredFields.filter(field => sample[field] === null || sample[field] === undefined);
  
  if (nullFields.length > 0) {
    await logger.error(`❌ Null/undefined chart data fields: ${nullFields.join(', ')}`);
  } else {
    await logger.success(`✅ No null/undefined values in chart data`);
  }
  
  // Check for negative values (which might indicate data issues)
  const negativeFields = requiredFields.filter(field => 
    typeof sample[field] === 'number' && sample[field] < 0
  );
  
  if (negativeFields.length > 0) {
    await logger.warn(`⚠️ Negative values in chart data: ${negativeFields.join(', ')}`);
  }
  
  // Check if all activity metrics are zero (might indicate missing data)
  const activityFields = ['activityCompleted', 'activityPending', 'activityFailed', 'activityCancelled', 'activityProcessing'];
  const allActivityZero = activityFields.every(field => sample[field] === 0);
  
  if (allActivityZero) {
    await logger.warn(`⚠️ All activity metrics are zero - this might indicate missing activity data`);
  } else {
    await logger.success(`✅ Activity metrics contain non-zero values`);
  }
}

async function validateDataConsistency(chartData: any[], hours: number) {
  await logger.info(`🔍 Checking data consistency across ${chartData.length} data points...`);
  
  // Check for gaps in time series
  const timeGaps = [];
  for (let i = 1; i < chartData.length; i++) {
    const prev = new Date(chartData[i - 1].time);
    const curr = new Date(chartData[i].time);
    
    // This is a simple check - in real scenarios you'd want more sophisticated gap detection
    if (isNaN(prev.getTime()) || isNaN(curr.getTime())) {
      timeGaps.push(i);
    }
  }
  
  if (timeGaps.length > 0) {
    await logger.warn(`⚠️ Found ${timeGaps.length} time gaps in data`);
  } else {
    await logger.success(`✅ No obvious time gaps detected`);
  }
  
  // Check for data points where all values are zero
  const allZeroPoints = chartData.filter(point => 
    point.queueSize === 0 && point.processed === 0 && point.successful === 0 && 
    point.failed === 0 && point.activityCompleted === 0 && point.activityPending === 0 &&
    point.activityFailed === 0 && point.activityCancelled === 0 && point.activityProcessing === 0
  );
  
  if (allZeroPoints.length > 0) {
    await logger.warn(`⚠️ Found ${allZeroPoints.length} data points with all zero values`);
  } else {
    await logger.success(`✅ No data points with all zero values`);
  }
  
  // Calculate some basic statistics
  const totalActivity = chartData.reduce((sum, point) => 
    sum + point.activityCompleted + point.activityPending + point.activityFailed + 
    point.activityCancelled + point.activityProcessing, 0
  );
  
  const totalTransactions = chartData.reduce((sum, point) => 
    sum + point.processed + point.successful + point.failed, 0
  );
  
  await logger.info(`📊 Data Summary:
    📈 Total Activity Points: ${totalActivity}
    📈 Total Transaction Points: ${totalTransactions}
    📊 Average Activity per Hour: ${(totalActivity / chartData.length).toFixed(2)}
    📊 Average Transactions per Hour: ${(totalTransactions / chartData.length).toFixed(2)}`);
}

// Run the validation
validateChartData().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});