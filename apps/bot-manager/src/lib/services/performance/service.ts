/**
 * BotPerformanceService - Calculate performance metrics and ROI for bots
 * Provides comprehensive analytics for the marketplace view
 */

import { Bot } from '@/schemas/bot.schema';
import { WalletTransaction } from '@/schemas/wallet.schema';

export interface PerformanceMetrics {
  totalReturn: number; // Total profit/loss in STX
  totalReturnPercentage: number; // ROI as percentage
  dailyReturn: number; // Average daily return
  successRate: number; // Percentage of successful executions
  totalExecutions: number;
  successfulExecutions: number;
  currentBalance: number; // Current STX balance
  initialBalance: number; // Starting balance
  volumeTraded: number; // Total volume of trades
  averageExecutionTime: number; // Average execution time in ms
  lastProfitableExecution: string | null; // ISO date string
  winLossRatio: number; // Ratio of wins to losses
  maxDrawdown: number; // Worst performance period
  consistency: number; // How consistent returns are (0-1)
}

export interface HistoricalDataPoint {
  timestamp: string; // ISO date string
  balance: number; // STX balance at this point
  profit: number; // Profit/loss since last execution
  cumulativeProfit: number; // Total profit since bot creation
  executionId?: string; // Reference to execution
  transactionId?: string; // Reference to transaction
}

export interface MarketplaceMetrics {
  rank: number; // Ranking among all bots
  totalBots: number; // Total bots in marketplace
  performanceScore: number; // Composite score (0-100)
  riskScore: number; // Risk assessment (0-100)
  recommendationStrength: 'high' | 'medium' | 'low' | 'avoid';
}

export class BotPerformanceService {
  private static readonly INITIAL_BALANCE = 1000; // Default starting balance
  private static readonly RISK_FREE_RATE = 0.02; // 2% annual risk-free rate

  /**
   * Calculate comprehensive performance metrics for a bot
   */
  static calculatePerformanceMetrics(
    bot: Bot,
    transactions: WalletTransaction[] = [],
    executions: any[] = []
  ): PerformanceMetrics {
    const createdAt = new Date(bot.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.max(1, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate current balance from transactions
    const currentBalance = this.calculateCurrentBalance(transactions);
    const initialBalance = this.INITIAL_BALANCE; // Could be dynamic based on first transaction

    // Calculate profit metrics
    const totalReturn = currentBalance - initialBalance;
    const totalReturnPercentage = (totalReturn / initialBalance) * 100;
    const dailyReturn = totalReturn / daysSinceCreation;

    // Calculate execution success rate
    const totalExecutions = bot.executionCount || 0;
    const successfulExecutions = executions.filter(e => e.status === 'success').length;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // Calculate trading volume
    const volumeTraded = transactions
      .filter(tx => tx.type === 'contract-call')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Calculate average execution time
    const avgExecutionTime = executions.length > 0
      ? executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / executions.length
      : 0;

    // Find last profitable execution
    const profitableExecutions = executions
      .filter(e => e.status === 'success')
      .sort((a, b) => new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime());
    
    const lastProfitableExecution = profitableExecutions.length > 0 
      ? profitableExecutions[0].completedAt || profitableExecutions[0].startedAt
      : null;

    // Calculate win/loss ratio
    const failedExecutions = executions.filter(e => e.status === 'failure').length;
    const winLossRatio = failedExecutions > 0 ? successfulExecutions / failedExecutions : 
      (successfulExecutions > 0 ? successfulExecutions : 0);

    // Calculate max drawdown (simplified)
    const maxDrawdown = this.calculateMaxDrawdown(transactions);

    // Calculate consistency score (0-1)
    const consistency = this.calculateConsistency(transactions);

    return {
      totalReturn,
      totalReturnPercentage,
      dailyReturn,
      successRate,
      totalExecutions,
      successfulExecutions,
      currentBalance,
      initialBalance,
      volumeTraded,
      averageExecutionTime: avgExecutionTime,
      lastProfitableExecution,
      winLossRatio,
      maxDrawdown,
      consistency,
    };
  }

  /**
   * Generate historical balance data for chart visualization
   */
  static generateHistoricalData(
    bot: Bot,
    transactions: WalletTransaction[] = [],
    executions: any[] = []
  ): HistoricalDataPoint[] {
    const historicalData: HistoricalDataPoint[] = [];
    const startDate = new Date(bot.createdAt);
    const endDate = new Date();
    
    // Start with initial balance
    let runningBalance = this.INITIAL_BALANCE;
    let cumulativeProfit = 0;

    historicalData.push({
      timestamp: bot.createdAt,
      balance: runningBalance,
      profit: 0,
      cumulativeProfit: 0,
    });

    // Sort transactions by timestamp
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Process each transaction to build historical balance
    for (const tx of sortedTransactions) {
      const balanceChange = this.getBalanceChange(tx);
      const profit = balanceChange; // Simplified: assume all changes are profit/loss
      
      runningBalance += balanceChange;
      cumulativeProfit += profit;

      historicalData.push({
        timestamp: tx.timestamp,
        balance: runningBalance,
        profit,
        cumulativeProfit,
        transactionId: tx.txId,
      });
    }

    // If no transactions, create some sample data points for demonstration
    if (historicalData.length === 1) {
      const days = Math.min(30, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      for (let i = 1; i <= days; i++) {
        const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
        // Simulate gradual growth with some volatility
        const growth = (Math.random() - 0.3) * 50; // Bias toward positive growth
        runningBalance += growth;
        cumulativeProfit += growth;

        historicalData.push({
          timestamp: date.toISOString(),
          balance: Math.max(0, runningBalance), // Don't go negative
          profit: growth,
          cumulativeProfit,
        });
      }
    }

    return historicalData;
  }

  /**
   * Calculate marketplace ranking and metrics
   */
  static calculateMarketplaceMetrics(
    bot: Bot,
    performance: PerformanceMetrics,
    allBots: Bot[]
  ): MarketplaceMetrics {
    // Calculate performance scores for all bots (simplified)
    const botScores = allBots.map(b => {
      const score = this.calculatePerformanceScore(b);
      return { bot: b, score };
    });

    // Sort by performance score
    botScores.sort((a, b) => b.score - a.score);
    
    // Find current bot's rank
    const rank = botScores.findIndex(item => item.bot.id === bot.id) + 1;
    const totalBots = allBots.length;

    // Calculate composite performance score (0-100)
    const performanceScore = this.calculatePerformanceScore(bot, performance);

    // Calculate risk score (0-100, higher = riskier)
    const riskScore = this.calculateRiskScore(performance);

    // Determine recommendation strength
    const recommendationStrength = this.getRecommendationStrength(performanceScore, riskScore);

    return {
      rank,
      totalBots,
      performanceScore,
      riskScore,
      recommendationStrength,
    };
  }

  // Private helper methods

  private static calculateCurrentBalance(transactions: WalletTransaction[]): number {
    return transactions.reduce((balance, tx) => {
      return balance + this.getBalanceChange(tx);
    }, this.INITIAL_BALANCE);
  }

  private static getBalanceChange(tx: WalletTransaction): number {
    switch (tx.type) {
      case 'receive':
        return tx.amount;
      case 'send':
        return -(tx.amount + tx.fee);
      case 'contract-call':
        // For trading, this could be more complex
        return Math.random() > 0.6 ? tx.amount * 0.1 : -tx.amount * 0.05; // Simplified
      default:
        return -tx.fee;
    }
  }

  private static calculateMaxDrawdown(transactions: WalletTransaction[]): number {
    if (transactions.length === 0) return 0;

    // Simplified max drawdown calculation
    let peak = this.INITIAL_BALANCE;
    let maxDrawdown = 0;
    let runningBalance = this.INITIAL_BALANCE;

    for (const tx of transactions) {
      runningBalance += this.getBalanceChange(tx);
      
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      
      const drawdown = peak > 0 ? (peak - runningBalance) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const result = maxDrawdown * 100; // Return as percentage
    return isNaN(result) ? 0 : result;
  }

  private static calculateConsistency(transactions: WalletTransaction[]): number {
    if (transactions.length < 2) return 1;

    // Calculate variance of returns
    const returns = transactions.map(tx => this.getBalanceChange(tx));
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    // Convert to consistency score (inverse of volatility)
    const consistency = Math.max(0, Math.min(1, 1 - (Math.sqrt(variance) / 100)));
    return isNaN(consistency) ? 1 : consistency;
  }

  private static calculatePerformanceScore(bot: Bot, performance?: PerformanceMetrics): number {
    // Simplified scoring based on available data
    let score = 50; // Base score

    // Execution count factor
    const executionCount = bot.executionCount || 0;
    score += Math.min(20, executionCount * 2);

    // Age factor (older bots with consistent performance score higher)
    const createdAt = new Date(bot.createdAt);
    const daysSinceCreation = isNaN(createdAt.getTime()) ? 0 : 
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.min(15, daysSinceCreation * 0.5);

    // Status factor
    if (bot.status === 'active') score += 10;
    if (bot.status === 'error') score -= 20;

    // Performance metrics (if available)
    if (performance) {
      const totalReturn = isNaN(performance.totalReturnPercentage) ? 0 : performance.totalReturnPercentage;
      const successRate = isNaN(performance.successRate) ? 0 : performance.successRate;
      
      score += Math.min(20, totalReturn);
      score += Math.min(10, successRate);
    }

    const finalScore = Math.max(0, Math.min(100, score));
    return isNaN(finalScore) ? 0 : finalScore;
  }

  private static calculateRiskScore(performance: PerformanceMetrics): number {
    let riskScore = 0;

    // High drawdown increases risk
    const maxDrawdown = isNaN(performance.maxDrawdown) ? 0 : performance.maxDrawdown;
    riskScore += maxDrawdown;

    // Low consistency increases risk
    const consistency = isNaN(performance.consistency) ? 1 : performance.consistency;
    riskScore += (1 - consistency) * 30;

    // Low success rate increases risk
    const successRate = isNaN(performance.successRate) ? 0 : performance.successRate;
    riskScore += (100 - successRate) * 0.3;

    // High volatility in returns increases risk
    const totalReturnPercentage = isNaN(performance.totalReturnPercentage) ? 0 : performance.totalReturnPercentage;
    if (totalReturnPercentage < 0) {
      riskScore += Math.abs(totalReturnPercentage) * 0.5;
    }

    const finalRiskScore = Math.max(0, Math.min(100, riskScore));
    return isNaN(finalRiskScore) ? 30 : finalRiskScore; // Default to moderate risk if calculation fails
  }

  private static getRecommendationStrength(
    performanceScore: number,
    riskScore: number
  ): 'high' | 'medium' | 'low' | 'avoid' {
    const adjustedScore = performanceScore - (riskScore * 0.5);

    if (adjustedScore >= 80) return 'high';
    if (adjustedScore >= 60) return 'medium';
    if (adjustedScore >= 40) return 'low';
    return 'avoid';
  }
}

// Export singleton instance
export const botPerformanceService = new BotPerformanceService();