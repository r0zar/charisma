// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}
import type {
  TokensMessage,
  TokensStoreData,
  EnhancedTokenRecord,
  WebSocketTokenBalance,
  PriceUpdate,
  TokenMetadataMessage,
  UserPortfolioMessage,
  TokenBatchMessage,
  UnifiedServerInfo
} from '../types/tokens';

/**
 * TokensStore - EventEmitter-based store for unified token data
 *
 * This store manages all token-related data (metadata, balances, prices) from
 * the unified tokens party server, following the same EventEmitter pattern
 * as the existing BlazeStore for consistency.
 */
export class TokensStore extends EventEmitter {
  private data: TokensStoreData;

  constructor() {
    super();
    this.data = {
      metadata: new Map(),
      balances: new Map(),
      prices: new Map(),
      lastUpdate: Date.now()
    };
  }

  /**
   * Get current store data (immutable copy)
   */
  getData(): TokensStoreData {
    return {
      metadata: new Map(this.data.metadata),
      balances: new Map(this.data.balances), 
      prices: new Map(this.data.prices),
      lastUpdate: this.data.lastUpdate
    };
  }

  /**
   * Handle incoming WebSocket messages from the unified tokens server
   */
  handleMessage(message: TokensMessage): void {
    let dataChanged = false;

    try {
      switch (message.type) {
        case 'TOKEN_METADATA':
          this.handleTokenMetadata(message as TokenMetadataMessage);
          dataChanged = true;
          break;

        case 'USER_PORTFOLIO':
          this.handleUserPortfolio(message as UserPortfolioMessage);
          dataChanged = true;
          break;

        case 'TOKEN_BATCH':
          this.handleTokenBatch(message as TokenBatchMessage);
          dataChanged = true;
          break;

        case 'PRICE_UPDATE':
          this.handlePriceUpdate(message as PriceUpdate);
          dataChanged = true;
          break;

        case 'PRICE_BATCH':
          this.handlePriceBatch(message as any);
          dataChanged = true;
          break;

        case 'BALANCE_UPDATE':
          this.handleBalanceUpdate(message as any);
          dataChanged = true;
          break;

        case 'SERVER_INFO':
          this.handleServerInfo(message as UnifiedServerInfo);
          // Server info doesn't change data, just logs
          break;

        case 'ERROR':
          console.error('TokensStore: Server error:', message.message);
          break;

        case 'PONG':
          // Heartbeat response, no action needed
          break;

        default:
          console.warn('TokensStore: Unknown message type:', (message as any).type);
          break;
      }

      if (dataChanged) {
        this.data.lastUpdate = Date.now();
        this.emit('update');
      }
    } catch (error) {
      console.error('TokensStore: Error processing message:', error, message);
    }
  }

  /**
   * Handle token metadata messages
   */
  private handleTokenMetadata(message: TokenMetadataMessage): void {
    this.data.metadata.set(message.contractId, message.metadata);
  }

  /**
   * Handle user portfolio messages (contains balances and metadata)
   */
  private handleUserPortfolio(message: UserPortfolioMessage): void {
    const { userId, balances, tokens } = message;

    // Store metadata from tokens
    tokens.forEach(tokenMsg => {
      this.data.metadata.set(tokenMsg.contractId, tokenMsg.metadata);
    });

    // Store balances with composite key format: userId:contractId
    if (balances) {
      balances.forEach((balance: any) => {
        const key = `${userId}:${balance.mainnetContractId}`;
        this.data.balances.set(key, balance);
      });
    }
  }

  /**
   * Handle token batch messages (metadata with optional prices)
   */
  private handleTokenBatch(message: TokenBatchMessage): void {
    const { metadata, prices } = message;

    // Store metadata if provided
    if (metadata) {
      metadata.forEach(metadataMsg => {
        this.data.metadata.set(metadataMsg.contractId, metadataMsg.metadata);
        
        // Also store any current price included in metadata message
        if (metadataMsg.currentPrice) {
          this.data.prices.set(metadataMsg.contractId, metadataMsg.currentPrice);
        }
      });
    }

    // Store prices if provided separately
    if (prices) {
      prices.forEach(price => {
        this.data.prices.set(price.contractId, price);
      });
    }
  }

  /**
   * Handle individual price updates
   */
  private handlePriceUpdate(message: PriceUpdate): void {
    this.data.prices.set(message.contractId, message);
  }

  /**
   * Handle batch price updates
   */
  private handlePriceBatch(message: any): void {
    if (message.prices && Array.isArray(message.prices)) {
      message.prices.forEach((priceUpdate: PriceUpdate) => {
        this.data.prices.set(priceUpdate.contractId, priceUpdate);
      });
    }
  }

  /**
   * Handle individual balance updates
   */
  private handleBalanceUpdate(message: any): void {
    if (message.userId && message.contractId) {
      const key = `${message.userId}:${message.contractId}`;
      const balance: WebSocketTokenBalance = {
        balance: message.balance || 0,
        totalSent: message.totalSent || '0',
        totalReceived: message.totalReceived || '0',
        formattedBalance: message.formattedBalance || 0,
        timestamp: message.timestamp || Date.now(),
        source: message.source || 'unknown',
        contractId: message.contractId,
        mainnetContractId: message.contractId,
        subnetBalance: message.subnetBalance,
        subnetTotalSent: message.subnetTotalSent,
        subnetTotalReceived: message.subnetTotalReceived,
        subnetFormattedBalance: message.subnetFormattedBalance,
        subnetContractId: message.subnetContractId
      };
      this.data.balances.set(key, balance);
    }
  }

  /**
   * Handle server info messages
   */
  private handleServerInfo(message: UnifiedServerInfo): void {
    console.log('TokensStore: Server info:', {
      activeSubscriptions: message.activeSubscriptions,
      totalClients: message.totalClients,
      uptime: message.uptime
    });
  }

  // Helper methods for easy data access

  /**
   * Get token metadata by contract ID
   */
  getTokenMetadata(contractId: string): EnhancedTokenRecord | undefined {
    return this.data.metadata.get(contractId);
  }

  /**
   * Get user balance for specific token
   */
  getUserBalance(userId: string, contractId: string): WebSocketTokenBalance | undefined {
    const key = `${userId}:${contractId}`;
    return this.data.balances.get(key);
  }

  /**
   * Get token price by contract ID
   */
  getTokenPrice(contractId: string): PriceUpdate | undefined {
    return this.data.prices.get(contractId);
  }

  /**
   * Get user's complete portfolio
   */
  getUserPortfolio(userId: string) {
    const userBalances: WebSocketTokenBalance[] = [];
    const userTokens: EnhancedTokenRecord[] = [];
    let totalValueUSD = 0;

    // Find all balances for this user
    for (const [key, balance] of this.data.balances) {
      if (key.startsWith(`${userId}:`)) {
        userBalances.push(balance);
        
        // Get token metadata
        const metadata = this.data.metadata.get(balance.mainnetContractId);
        if (metadata) {
          userTokens.push(metadata);
        }

        // Calculate value if price is available
        const price = this.data.prices.get(balance.mainnetContractId);
        if (price && metadata) {
          const tokenAmount = balance.balance / Math.pow(10, metadata.decimals);
          totalValueUSD += tokenAmount * price.price;
        }
      }
    }

    return {
      tokens: userTokens,
      balances: userBalances,
      totalValueUSD: totalValueUSD > 0 ? totalValueUSD : undefined
    };
  }
}