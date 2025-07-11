/**
 * Search Service
 * Provides unified search functionality across all data types
 */

import { Bot } from '@/schemas/bot.schema';
import { StoredNotification } from '@/schemas/notification.schema';
import { WalletTransaction } from '@/schemas/wallet.schema';

import { 
  BotSearchResult, 
  NotificationSearchResult, 
  SearchOptions, 
  SearchQuery, 
  SearchResults,
  TransactionSearchResult,
  UserSearchResult} from './types';

interface SearchableData {
  bots: Bot[];
  notifications: StoredNotification[];
  users: Array<{
    userId: string;
    address: string;
    connectionMethod?: string;
    network?: string;
    lastActive?: string;
  }>;
  transactions: WalletTransaction[];
}

export class SearchService {
  private defaultOptions: SearchOptions = {
    maxResults: 25,
    categories: ['bot', 'notification', 'user', 'transaction'],
    fuzzyThreshold: 0.3,
    includeInactive: true
  };

  /**
   * Perform a unified search across all data types
   */
  async search(query: SearchQuery, data: SearchableData): Promise<SearchResults> {
    const startTime = Date.now();
    const options = { ...this.defaultOptions, ...query.options };
    
    if (!query.query.trim()) {
      return {
        bots: [],
        notifications: [],
        users: [],
        transactions: [],
        totalResults: 0,
        query: query.query,
        searchTime: 0
      };
    }

    const searchTerm = query.query.toLowerCase().trim();
    const results: SearchResults = {
      bots: [],
      notifications: [],
      users: [],
      transactions: [],
      totalResults: 0,
      query: query.query,
      searchTime: 0
    };

    // Search bots
    if (options.categories!.includes('bot')) {
      results.bots = this.searchBots(searchTerm, data.bots, options);
    }

    // Search notifications
    if (options.categories!.includes('notification')) {
      results.notifications = this.searchNotifications(searchTerm, data.notifications, options);
    }

    // Search users
    if (options.categories!.includes('user')) {
      results.users = this.searchUsers(searchTerm, data.users, options);
    }

    // Search transactions
    if (options.categories!.includes('transaction')) {
      results.transactions = this.searchTransactions(searchTerm, data.transactions, options);
    }

    results.totalResults = results.bots.length + results.notifications.length + 
                          results.users.length + results.transactions.length;
    results.searchTime = Date.now() - startTime;

    return results;
  }

  /**
   * Search bots by name, strategy, owner, and status
   */
  private searchBots(searchTerm: string, bots: Bot[], options: SearchOptions): BotSearchResult[] {
    const results: BotSearchResult[] = [];
    
    for (const bot of bots) {
      let score = 0;
      const searchableFields = [
        bot.name,
        bot.strategy,
        bot.ownerId,
        bot.status,
        bot.id
      ];

      // Calculate relevance score
      for (const field of searchableFields) {
        if (field && field.toLowerCase().includes(searchTerm)) {
          if (field.toLowerCase().startsWith(searchTerm)) {
            score += 10; // Higher score for prefix match
          } else {
            score += 5; // Lower score for substring match
          }
        }
      }

      // Fuzzy matching for typos
      if (score === 0) {
        score = this.calculateFuzzyScore(searchTerm, bot.name.toLowerCase());
      }

      if (score > 0) {
        results.push({
          id: bot.id,
          type: 'bot',
          title: bot.name,
          description: `${bot.status} • Strategy: ${this.getStrategyDisplayName(bot.strategy)}`,
          score,
          data: bot,
          metadata: {
            status: bot.status,
            ownerId: bot.ownerId,
            strategyType: this.getStrategyDisplayName(bot.strategy),
            lastActive: bot.lastActive
          }
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults);
  }

  /**
   * Search notifications by title, message, type, and category
   */
  private searchNotifications(searchTerm: string, notifications: StoredNotification[], options: SearchOptions): NotificationSearchResult[] {
    const results: NotificationSearchResult[] = [];
    
    for (const notification of notifications) {
      let score = 0;
      const searchableFields = [
        notification.title,
        notification.message,
        notification.type,
        notification.category || '',
        notification.id
      ];

      // Calculate relevance score
      for (const field of searchableFields) {
        if (field && field.toLowerCase().includes(searchTerm)) {
          if (field.toLowerCase().startsWith(searchTerm)) {
            score += 10;
          } else {
            score += 5;
          }
        }
      }

      // Fuzzy matching
      if (score === 0) {
        score = this.calculateFuzzyScore(searchTerm, notification.title.toLowerCase());
      }

      if (score > 0) {
        results.push({
          id: notification.id,
          type: 'notification',
          title: notification.title,
          description: notification.message,
          score,
          data: notification,
          metadata: {
            notificationType: notification.type,
            category: notification.category,
            priority: notification.priority,
            read: notification.read,
            timestamp: notification.timestamp
          }
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults);
  }

  /**
   * Search users by wallet address and connection info
   */
  private searchUsers(searchTerm: string, users: Array<{
    userId: string;
    address: string;
    connectionMethod?: string;
    network?: string;
    lastActive?: string;
  }>, options: SearchOptions): UserSearchResult[] {
    const results: UserSearchResult[] = [];
    
    for (const user of users) {
      let score = 0;
      const searchableFields = [
        user.userId,
        user.address,
        user.connectionMethod || '',
        user.network || ''
      ];

      // Calculate relevance score
      for (const field of searchableFields) {
        if (field && field.toLowerCase().includes(searchTerm)) {
          if (field.toLowerCase().startsWith(searchTerm)) {
            score += 10;
          } else {
            score += 5;
          }
        }
      }

      if (score > 0) {
        results.push({
          id: user.userId,
          type: 'user',
          title: this.formatAddress(user.address),
          description: `${user.connectionMethod || 'Unknown'} • ${user.network || 'Unknown network'}`,
          score,
          data: user,
          metadata: {
            walletAddress: user.address,
            connectionStatus: user.connectionMethod ? 'Connected' : 'Disconnected',
            network: user.network
          }
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults);
  }

  /**
   * Search transactions by ID, type, amount, and token
   */
  private searchTransactions(searchTerm: string, transactions: WalletTransaction[], options: SearchOptions): TransactionSearchResult[] {
    const results: TransactionSearchResult[] = [];
    
    for (const transaction of transactions) {
      let score = 0;
      const searchableFields = [
        transaction.txId,
        transaction.type,
        transaction.token || '',
        transaction.memo || '',
        transaction.amount.toString()
      ];

      // Calculate relevance score
      for (const field of searchableFields) {
        if (field && field.toLowerCase().includes(searchTerm)) {
          if (field.toLowerCase().startsWith(searchTerm)) {
            score += 10;
          } else {
            score += 5;
          }
        }
      }

      if (score > 0) {
        results.push({
          id: transaction.txId,
          type: 'transaction',
          title: `${transaction.type} • ${transaction.token || 'STX'}`,
          description: `${transaction.amount} ${transaction.token || 'STX'} • ${transaction.status}`,
          score,
          data: transaction,
          metadata: {
            txId: transaction.txId,
            type: transaction.type,
            amount: transaction.amount,
            token: transaction.token || 'STX',
            status: transaction.status,
            timestamp: transaction.timestamp
          }
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults);
  }

  /**
   * Calculate fuzzy matching score for typo tolerance
   */
  private calculateFuzzyScore(searchTerm: string, text: string): number {
    if (!searchTerm || !text) return 0;
    
    const maxLength = Math.max(searchTerm.length, text.length);
    const distance = this.levenshteinDistance(searchTerm, text);
    const similarity = 1 - (distance / maxLength);
    
    return similarity > 0.6 ? Math.floor(similarity * 10) : 0;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Format wallet address for display
   */
  private formatAddress(address: string): string {
    if (!address) return 'Unknown Address';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  /**
   * Get display name for strategy
   */
  private getStrategyDisplayName(strategy: string): string {
    if (!strategy) return 'Unknown Strategy';
    
    // Try to extract strategy type from code
    if (strategy.includes('yield') || strategy.includes('farming')) {
      return 'Yield Farming';
    }
    if (strategy.includes('arbitrage')) {
      return 'Arbitrage';
    }
    if (strategy.includes('dca') || strategy.includes('dollar cost')) {
      return 'DCA';
    }
    if (strategy.includes('liquidity')) {
      return 'Liquidity Provision';
    }
    
    return 'Custom Strategy';
  }
}

// Export singleton instance
export const searchService = new SearchService();