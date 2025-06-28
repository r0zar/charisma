import type * as Party from "partykit/server";
import {
  fetchUserBalances,
  loadTokenMetadata,
  formatBalance,
  createBalanceUpdateMessage,
  isValidUserAddress,
  type EnhancedTokenRecord
} from "../balances-lib";
import { listPrices } from "@repo/tokens";
import type {
  BalanceUpdateMessage,
  BalanceBatchMessage,
  PriceUpdateMessage,
  PriceBatchMessage,
  TokensMessage,
  UnifiedSubscription,
  UnifiedServerInfo,
  TokenBatchMessage,
  TokenMetadataMessage,
} from "blaze-sdk/realtime";

interface ClientSubscription {
  userIds: Set<string>;
  contractIds: Set<string>;
  includePrices: boolean;
  subscribeToAll: boolean;
  lastSeen: number;
}

export default class TokensParty implements Party.Server {
  private subscriptions = new Map<string, ClientSubscription>();
  private tokenRecords = new Map<string, EnhancedTokenRecord>();
  private balances = new Map<string, BalanceUpdateMessage>();
  private prices = new Map<string, PriceUpdateMessage>();
  private watchedUsers = new Set<string>();
  private watchedTokens = new Set<string>();

  private balanceInterval: NodeJS.Timeout | null = null;
  private priceInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  constructor(readonly room: Party.Room) {
    console.log(`🪙 Tokens party room: ${this.room.id}`);
    this.loadTokenMetadata();
    this.startIntervals();
  }

  private detectLocalDev(): boolean {
    try {
      return process.env.NODE_ENV === 'development' ||
        process.env.PARTYKIT_ENV === 'development' ||
        (typeof globalThis !== 'undefined' &&
          globalThis.location?.hostname === 'localhost');
    } catch {
      return false;
    }
  }

  private async loadTokenMetadata() {
    try {
      this.tokenRecords = await loadTokenMetadata();
      console.log(`🏷️ Loaded ${this.tokenRecords.size} token records`);
    } catch (error) {
      console.error('🏷️ Failed to load token metadata:', error);
    }
  }

  private startIntervals() {
    // Balance updates every 5 minutes
    this.balanceInterval = setInterval(() => {
      this.fetchAndBroadcastBalances();
    }, 300_000);

    // Price updates every minute
    this.priceInterval = setInterval(() => {
      this.fetchAndBroadcastPrices();
    }, 60_000);

    // Initial fetches after 3 seconds
    setTimeout(() => {
      this.fetchAndBroadcastBalances();
      this.fetchAndBroadcastPrices();
    }, 3_000);
  }

  onConnect(conn: Party.Connection) {
    const clientId = conn.id;
    console.log(`🔌 Client ${clientId} connected`);

    this.subscriptions.set(clientId, {
      userIds: new Set(),
      contractIds: new Set(),
      includePrices: false,
      subscribeToAll: false,
      lastSeen: Date.now()
    });

    // Send server info
    const serverInfo: UnifiedServerInfo = {
      type: 'SERVER_INFO',
      party: 'tokens',
      isLocalDev: this.detectLocalDev(),
      metadataLoaded: this.tokenRecords.size > 0,
      metadataCount: this.tokenRecords.size,
      priceCount: this.prices.size,
      balanceCount: this.balances.size,
      activeSubscriptions: this.subscriptions.size,
      totalClients: this.subscriptions.size,
      uptime: Date.now() - this.startTime,
      timestamp: Date.now()
    };
    conn.send(JSON.stringify(serverInfo));

    // Send cached data
    this.sendCachedData(clientId);
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as TokensMessage;
      const clientId = sender.id;

      switch (data.type) {
        case 'SUBSCRIBE':
        case 'UNSUBSCRIBE':
          this.handleUnifiedSubscribe(data as UnifiedSubscription, clientId);
          break;
        case 'PING':
          sender.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp || Date.now() }));
          break;
        case 'MANUAL_UPDATE':
          this.fetchAndBroadcastBalances();
          this.fetchAndBroadcastPrices();
          break;
        default:
          sender.send(JSON.stringify({ type: 'ERROR', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      sender.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
    }
  }

  onClose(connection: Party.Connection) {
    const clientId = connection.id;
    this.subscriptions.delete(clientId);
    this.cleanupWatchedItems();

    if (this.subscriptions.size === 0) {
      if (this.balanceInterval) clearInterval(this.balanceInterval);
      if (this.priceInterval) clearInterval(this.priceInterval);
    }
  }

  onRequest(request: Party.Request) {
    if (request.method === 'GET') {

      return new Response(JSON.stringify({
        balances: Array.from(this.balances.values()),
        prices: Array.from(this.prices.values()),
        metadata: Array.from(this.tokenRecords.values()),
        party: 'tokens',
        serverTime: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      this.fetchAndBroadcastBalances();
      this.fetchAndBroadcastPrices();
      return new Response(JSON.stringify({
        status: 'triggered',
        party: 'tokens',
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }

  async onAlarm() {
    try {
      await Promise.all([
        this.fetchAndBroadcastBalances(),
        this.fetchAndBroadcastPrices()
      ]);
      this.room.storage.setAlarm(Date.now() + 300_000);
    } catch (err) {
      console.error('Tokens alarm failed:', err);
      this.room.storage.setAlarm(Date.now() + 300_000);
    }
  }

  private handleUnifiedSubscribe(data: UnifiedSubscription, clientId: string) {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    // Clear previous subscriptions
    subscription.userIds.clear();
    subscription.contractIds.clear();

    // Set new subscriptions
    if (data.userIds?.length) {
      data.userIds.filter(isValidUserAddress).forEach(userId => {
        subscription.userIds.add(userId);
        this.watchedUsers.add(userId);
      });
    }

    if (data.contractIds?.length) {
      data.contractIds.forEach(contractId => {
        subscription.contractIds.add(contractId);
        this.watchedTokens.add(contractId);
      });
    }

    subscription.includePrices = data.includePrices || false;
    subscription.subscribeToAll = (!data.userIds?.length && !data.contractIds?.length);

    console.log(`📊 Client ${clientId} unified subscription: ${subscription.userIds.size} users, ${subscription.contractIds.size} tokens, prices: ${subscription.includePrices}`);

    // Send relevant cached data
    this.sendCachedData(clientId);

    // Trigger fetches if needed
    if (subscription.userIds.size > 0) this.fetchAndBroadcastBalances();
    if (subscription.contractIds.size > 0 || subscription.includePrices) this.fetchAndBroadcastPrices();
  }

  private sendCachedData(clientId: string) {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    const conn = this.room.getConnection(clientId);
    if (!conn) return;

    // Send metadata batch
    if (this.tokenRecords.size > 0) {
      const metadataMessages: TokenMetadataMessage[] = Array.from(this.tokenRecords.values()).map(record => ({
        type: 'TOKEN_METADATA',
        contractId: record.contractId,
        metadata: record,
        currentPrice: this.prices.get(record.contractId),
        timestamp: Date.now()
      }));

      const tokenBatch: TokenBatchMessage = {
        type: 'TOKEN_BATCH',
        metadata: metadataMessages,
        timestamp: Date.now()
      };
      conn.send(JSON.stringify(tokenBatch));
    }

    // Send balance batch for subscribed users
    if (subscription.userIds.size > 0 && this.balances.size > 0) {
      const relevantBalances = Array.from(this.balances.values())
        .filter(balance => subscription.userIds.has(balance.userId));

      if (relevantBalances.length > 0) {
        const balanceBatch: BalanceBatchMessage = {
          type: 'BALANCE_BATCH',
          balances: relevantBalances,
          timestamp: Date.now()
        };
        conn.send(JSON.stringify(balanceBatch));
      }
    }

    // Send price batch if requested
    if (subscription.includePrices && this.prices.size > 0) {
      const prices = Array.from(this.prices.values());
      const priceBatch: PriceBatchMessage = {
        type: 'PRICE_BATCH',
        prices,
        timestamp: Date.now()
      };
      conn.send(JSON.stringify(priceBatch));
    }
  }

  private cleanupWatchedItems() {
    const activeUsers = new Set<string>();
    const activeTokens = new Set<string>();

    this.subscriptions.forEach(subscription => {
      subscription.userIds.forEach(userId => activeUsers.add(userId));
      subscription.contractIds.forEach(contractId => activeTokens.add(contractId));
    });

    this.watchedUsers = activeUsers;
    this.watchedTokens = activeTokens;
  }

  private async fetchAndBroadcastBalances() {
    if (this.watchedUsers.size === 0) return;

    try {
      const userIds = Array.from(this.watchedUsers);
      const rawBalances = await fetchUserBalances(userIds, this.tokenRecords);
      const messages: BalanceUpdateMessage[] = [];

      Object.entries(rawBalances).forEach(([key, balanceData]) => {
        const tokenRecord = this.tokenRecords.get(balanceData.contractId);
        if (!tokenRecord) return;

        const balanceInfo = {
          balance: balanceData.balance,
          totalSent: balanceData.totalSent,
          totalReceived: balanceData.totalReceived,
          formattedBalance: formatBalance(balanceData.balance.toString(), tokenRecord.decimals),
          timestamp: balanceData.timestamp,
          source: balanceData.source
        };

        const message = createBalanceUpdateMessage(
          tokenRecord,
          balanceData.userId,
          balanceInfo,
          this.tokenRecords,
          rawBalances
        );

        messages.push(message);
        this.balances.set(key, message);
      });

      if (messages.length > 0) {
        const balanceBatch: BalanceBatchMessage = {
          type: 'BALANCE_BATCH',
          balances: messages,
          timestamp: Date.now()
        };
        this.room.broadcast(JSON.stringify(balanceBatch));
      }

    } catch (error) {
      console.error('Failed to fetch/broadcast balances:', error);
    }
  }

  private async fetchAndBroadcastPrices() {
    try {
      const prices = await listPrices();
      const updates: PriceUpdateMessage[] = [];

      Object.entries(prices).forEach(([contractId, price]) => {
        if (typeof price !== 'number' || isNaN(price)) return;

        const update: PriceUpdateMessage = {
          type: 'PRICE_UPDATE',
          contractId,
          price,
          timestamp: Date.now(),
          source: 'api'
        };

        updates.push(update);
        this.prices.set(contractId, update);
      });

      if (updates.length > 0) {
        const priceBatch: PriceBatchMessage = {
          type: 'PRICE_BATCH',
          prices: updates,
          timestamp: Date.now()
        };
        this.room.broadcast(JSON.stringify(priceBatch));
      }

    } catch (error) {
      console.error('Failed to fetch/broadcast prices:', error);
    }
  }
}

TokensParty satisfies Party.Worker;