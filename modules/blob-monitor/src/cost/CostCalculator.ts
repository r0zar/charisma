/**
 * Cost Calculator
 * Calculates real-time costs and projections for Vercel Blob storage
 */

import type {
  BlobOperation,
  CostBreakdown,
  CostProjection,
  BlobInfo
} from '../types';
import { COST_LIMITS, FREE_TIERS } from '../types';

export class CostCalculator {
  private operationHistory: BlobOperation[] = [];
  private costHistory: Array<{ timestamp: number; cost: CostBreakdown }> = [];
  private currentMonth: number = new Date().getMonth();
  private currentYear: number = new Date().getFullYear();

  /**
   * Record a blob operation for cost calculation
   */
  async recordOperation(operation: BlobOperation): Promise<void> {
    this.operationHistory.push(operation);
    
    // Keep only last 30 days of operations
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.operationHistory = this.operationHistory.filter(op => op.timestamp > thirtyDaysAgo);
    
    // Calculate and store current costs
    const currentCost = this.calculateCurrentCosts();
    this.costHistory.push({
      timestamp: Date.now(),
      cost: currentCost
    });
    
    // Keep only last 24 hours of cost history
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.costHistory = this.costHistory.filter(entry => entry.timestamp > twentyFourHoursAgo);
  }

  /**
   * Calculate current costs based on recent operations
   */
  calculateCurrentCosts(): CostBreakdown {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Get operations from different time periods
    const dailyOps = this.operationHistory.filter(op => op.timestamp > oneDayAgo);
    const monthlyOps = this.operationHistory.filter(op => op.timestamp > oneMonthAgo);
    
    // Calculate operation costs
    const simpleOps = monthlyOps.filter(op => ['head', 'fetch'].includes(op.type));
    const advancedOps = monthlyOps.filter(op => ['put', 'copy', 'list'].includes(op.type));
    
    // Calculate cache misses (fetches without cache hit)
    const cacheMisses = monthlyOps.filter(op => op.type === 'fetch' && op.cacheHit === false);
    
    // Calculate storage costs (estimate based on put operations)
    const totalStorageGB = monthlyOps
      .filter(op => op.type === 'put' && op.size)
      .reduce((sum, op) => sum + (op.size! / (1024 * 1024 * 1024)), 0);
    
    // Calculate data transfer (estimate based on fetch operations)
    const totalTransferGB = monthlyOps
      .filter(op => op.type === 'fetch' && op.size)
      .reduce((sum, op) => sum + (op.size! / (1024 * 1024 * 1024)), 0);
    
    // Calculate fast origin transfer (cache misses)
    const fastOriginTransferGB = cacheMisses
      .filter(op => op.size)
      .reduce((sum, op) => sum + (op.size! / (1024 * 1024 * 1024)), 0);
    
    // Apply free tier deductions
    const storageAfterFree = Math.max(0, totalStorageGB - (FREE_TIERS.STORAGE / (1024 * 1024 * 1024)));
    const simpleOpsAfterFree = Math.max(0, simpleOps.length - FREE_TIERS.SIMPLE_OPERATIONS);
    const advancedOpsAfterFree = Math.max(0, advancedOps.length - FREE_TIERS.ADVANCED_OPERATIONS);
    const transferAfterFree = Math.max(0, totalTransferGB - (FREE_TIERS.DATA_TRANSFER / (1024 * 1024 * 1024)));
    
    // Calculate costs
    const costs: CostBreakdown = {
      storage: storageAfterFree * COST_LIMITS.STORAGE_PER_GB,
      simpleOperations: (simpleOpsAfterFree / 1000000) * COST_LIMITS.SIMPLE_OPERATIONS,
      advancedOperations: (advancedOpsAfterFree / 1000000) * COST_LIMITS.ADVANCED_OPERATIONS,
      dataTransfer: transferAfterFree * COST_LIMITS.DATA_TRANSFER,
      fastOriginTransfer: fastOriginTransferGB * COST_LIMITS.FAST_ORIGIN_TRANSFER,
      total: 0
    };
    
    costs.total = costs.storage + costs.simpleOperations + costs.advancedOperations + 
                  costs.dataTransfer + costs.fastOriginTransfer;
    
    return costs;
  }

  /**
   * Calculate cost projections
   */
  calculateCostProjections(): CostProjection {
    const currentCosts = this.calculateCurrentCosts();
    
    // Calculate trends based on recent cost history
    const trends = this.calculateTrends();
    
    // Project costs based on current usage and trends
    const projectedDaily: CostBreakdown = {
      storage: currentCosts.storage * (1 + trends.storageGrowth / 30),
      simpleOperations: currentCosts.simpleOperations * (1 + trends.operationGrowth / 30),
      advancedOperations: currentCosts.advancedOperations * (1 + trends.operationGrowth / 30),
      dataTransfer: currentCosts.dataTransfer * (1 + trends.operationGrowth / 30),
      fastOriginTransfer: currentCosts.fastOriginTransfer * (1 + trends.operationGrowth / 30),
      total: 0
    };
    projectedDaily.total = projectedDaily.storage + projectedDaily.simpleOperations + 
                          projectedDaily.advancedOperations + projectedDaily.dataTransfer + 
                          projectedDaily.fastOriginTransfer;
    
    const projectedMonthly: CostBreakdown = {
      storage: projectedDaily.storage * 30,
      simpleOperations: projectedDaily.simpleOperations * 30,
      advancedOperations: projectedDaily.advancedOperations * 30,
      dataTransfer: projectedDaily.dataTransfer * 30,
      fastOriginTransfer: projectedDaily.fastOriginTransfer * 30,
      total: projectedDaily.total * 30
    };
    
    const projectedYearly: CostBreakdown = {
      storage: projectedMonthly.storage * 12,
      simpleOperations: projectedMonthly.simpleOperations * 12,
      advancedOperations: projectedMonthly.advancedOperations * 12,
      dataTransfer: projectedMonthly.dataTransfer * 12,
      fastOriginTransfer: projectedMonthly.fastOriginTransfer * 12,
      total: projectedMonthly.total * 12
    };
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(currentCosts, trends);
    
    return {
      current: currentCosts,
      projected: {
        daily: projectedDaily,
        monthly: projectedMonthly,
        yearly: projectedYearly
      },
      trends,
      recommendations
    };
  }

  /**
   * Calculate cost for a specific blob size
   */
  calculateBlobCost(size: number, accessCount: number = 1, cacheHitRate: number = 0.8): number {
    const sizeGB = size / (1024 * 1024 * 1024);
    
    // Storage cost (monthly)
    const storageCost = sizeGB * COST_LIMITS.STORAGE_PER_GB;
    
    // Access costs
    const cacheHits = Math.floor(accessCount * cacheHitRate);
    const cacheMisses = accessCount - cacheHits;
    
    // Simple operations (cache hits)
    const simpleOpsCost = (cacheHits / 1000000) * COST_LIMITS.SIMPLE_OPERATIONS;
    
    // Advanced operations (initial put)
    const advancedOpsCost = (1 / 1000000) * COST_LIMITS.ADVANCED_OPERATIONS;
    
    // Data transfer (all accesses)
    const transferCost = sizeGB * accessCount * COST_LIMITS.DATA_TRANSFER;
    
    // Fast origin transfer (cache misses only)
    const fastOriginCost = sizeGB * cacheMisses * COST_LIMITS.FAST_ORIGIN_TRANSFER;
    
    return storageCost + simpleOpsCost + advancedOpsCost + transferCost + fastOriginCost;
  }

  /**
   * Estimate cost savings from optimization
   */
  estimateOptimizationSavings(
    currentSize: number,
    optimizedSize: number,
    accessCount: number = 10,
    cacheHitRate: number = 0.8
  ): number {
    const currentCost = this.calculateBlobCost(currentSize, accessCount, cacheHitRate);
    const optimizedCost = this.calculateBlobCost(optimizedSize, accessCount, cacheHitRate);
    
    return currentCost - optimizedCost;
  }

  /**
   * Get cost breakdown for specific time period
   */
  getCostBreakdown(days: number = 30): CostBreakdown {
    const timeAgo = Date.now() - (days * 24 * 60 * 60 * 1000);
    const relevantOps = this.operationHistory.filter(op => op.timestamp > timeAgo);
    
    // Similar calculation as calculateCurrentCosts but for specific period
    const simpleOps = relevantOps.filter(op => ['head', 'fetch'].includes(op.type));
    const advancedOps = relevantOps.filter(op => ['put', 'copy', 'list'].includes(op.type));
    const cacheMisses = relevantOps.filter(op => op.type === 'fetch' && op.cacheHit === false);
    
    const totalStorageGB = relevantOps
      .filter(op => op.type === 'put' && op.size)
      .reduce((sum, op) => sum + (op.size! / (1024 * 1024 * 1024)), 0);
    
    const totalTransferGB = relevantOps
      .filter(op => op.type === 'fetch' && op.size)
      .reduce((sum, op) => sum + (op.size! / (1024 * 1024 * 1024)), 0);
    
    const fastOriginTransferGB = cacheMisses
      .filter(op => op.size)
      .reduce((sum, op) => sum + (op.size! / (1024 * 1024 * 1024)), 0);
    
    const costs: CostBreakdown = {
      storage: totalStorageGB * COST_LIMITS.STORAGE_PER_GB,
      simpleOperations: (simpleOps.length / 1000000) * COST_LIMITS.SIMPLE_OPERATIONS,
      advancedOperations: (advancedOps.length / 1000000) * COST_LIMITS.ADVANCED_OPERATIONS,
      dataTransfer: totalTransferGB * COST_LIMITS.DATA_TRANSFER,
      fastOriginTransfer: fastOriginTransferGB * COST_LIMITS.FAST_ORIGIN_TRANSFER,
      total: 0
    };
    
    costs.total = costs.storage + costs.simpleOperations + costs.advancedOperations + 
                  costs.dataTransfer + costs.fastOriginTransfer;
    
    return costs;
  }

  /**
   * Calculate cost trends
   */
  private calculateTrends(): { storageGrowth: number; operationGrowth: number } {
    if (this.costHistory.length < 2) {
      return { storageGrowth: 0, operationGrowth: 0 };
    }
    
    const recent = this.costHistory.slice(-10); // Last 10 entries
    const older = this.costHistory.slice(0, 10);  // First 10 entries
    
    if (recent.length === 0 || older.length === 0) {
      return { storageGrowth: 0, operationGrowth: 0 };
    }
    
    const recentAvgStorage = recent.reduce((sum, entry) => sum + entry.cost.storage, 0) / recent.length;
    const olderAvgStorage = older.reduce((sum, entry) => sum + entry.cost.storage, 0) / older.length;
    
    const recentAvgOps = recent.reduce((sum, entry) => sum + entry.cost.simpleOperations + entry.cost.advancedOperations, 0) / recent.length;
    const olderAvgOps = older.reduce((sum, entry) => sum + entry.cost.simpleOperations + entry.cost.advancedOperations, 0) / older.length;
    
    const storageGrowth = olderAvgStorage > 0 ? (recentAvgStorage - olderAvgStorage) / olderAvgStorage : 0;
    const operationGrowth = olderAvgOps > 0 ? (recentAvgOps - olderAvgOps) / olderAvgOps : 0;
    
    return { storageGrowth, operationGrowth };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateRecommendations(costs: CostBreakdown, trends: { storageGrowth: number; operationGrowth: number }): string[] {
    const recommendations: string[] = [];
    
    // High storage costs
    if (costs.storage > 10) {
      recommendations.push("Consider implementing blob compression or archiving unused data");
    }
    
    // High fast origin transfer costs (cache misses)
    if (costs.fastOriginTransfer > 5) {
      recommendations.push("Optimize blob sizes to stay under 512MB cache limit");
    }
    
    // High operation costs
    if (costs.simpleOperations + costs.advancedOperations > 20) {
      recommendations.push("Review blob access patterns and implement caching strategies");
    }
    
    // Growing trends
    if (trends.storageGrowth > 0.1) {
      recommendations.push("Storage costs increasing by 10%+ - implement data lifecycle policies");
    }
    
    if (trends.operationGrowth > 0.2) {
      recommendations.push("Operation costs increasing by 20%+ - optimize access patterns");
    }
    
    // Total cost threshold
    if (costs.total > 50) {
      recommendations.push("Monthly costs exceeding $50 - review blob usage and implement cost controls");
    }
    
    return recommendations;
  }
}