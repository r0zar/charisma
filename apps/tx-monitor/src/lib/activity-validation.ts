/**
 * Validation utilities to prevent test/fake activities in production
 */

import { ActivityItem } from './activity-types';

/**
 * Validates that an activity is not a test/fake activity
 * Throws an error if test activity creation is attempted in production
 */
export function validateActivityForProduction(activity: Partial<ActivityItem>): void {
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.VERCEL_ENV === 'production' ||
                      !process.env.NODE_ENV;
  
  if (!isProduction) {
    // Allow test activities in development
    return;
  }
  
  // Check for test activity patterns
  const testPatterns = [
    activity.id?.includes('test-'),
    activity.txid?.includes('test-'),
    activity.owner?.includes('test'),
    activity.owner === 'unknown',
    activity.owner === 'SP1234567890ABCDEF',
    activity.fromToken?.symbol === 'unknown',
    activity.toToken?.symbol === 'unknown',
    activity.fromToken?.symbol === 'TEST',
    activity.toToken?.symbol === 'TEST',
    activity.metadata?.notes?.includes('test'),
    activity.metadata?.notes?.includes('dummy'),
  ];
  
  const hasTestPattern = testPatterns.some(pattern => pattern === true);
  
  if (hasTestPattern) {
    const error = new Error(`Test activity creation blocked in production environment`);
    console.error('🚫 Blocked test activity creation:', {
      id: activity.id,
      txid: activity.txid,
      owner: activity.owner,
      fromToken: activity.fromToken?.symbol,
      toToken: activity.toToken?.symbol,
      environment: process.env.NODE_ENV || 'production'
    });
    throw error;
  }
}

/**
 * Checks if an activity appears to be a test/fake activity
 */
export function isTestActivity(activity: ActivityItem): boolean {
  const testPatterns = [
    activity.id?.includes('test-'),
    activity.txid?.includes('test-'),
    activity.owner?.includes('test'),
    activity.owner === 'unknown',
    activity.owner === 'SP1234567890ABCDEF',
    activity.fromToken?.symbol === 'unknown',
    activity.toToken?.symbol === 'unknown',
    activity.fromToken?.symbol === 'TEST',
    activity.toToken?.symbol === 'TEST',
    activity.metadata?.notes?.includes('test'),
    activity.metadata?.notes?.includes('dummy'),
  ];
  
  return testPatterns.some(pattern => pattern === true);
}

/**
 * Validates that a transaction ID is real and not a test ID
 */
export function validateRealTransactionId(txid: string): boolean {
  if (!txid) return false;
  
  // Real Stacks transaction IDs are 64 character hex strings
  const realTxPattern = /^[a-f0-9]{64}$/i;
  
  // Test patterns to reject
  const testPatterns = [
    txid.includes('test-'),
    txid.startsWith('test'),
    txid.length < 20,
    !realTxPattern.test(txid)
  ];
  
  return !testPatterns.some(pattern => pattern === true);
}