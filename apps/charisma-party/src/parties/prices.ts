import type * as Party from "partykit/server";
import { listPrices } from "@repo/tokens";

interface PriceUpdate {
    type: 'PRICE_UPDATE';
    contractId: string;
    price: number;
    timestamp: number;
    source?: string;
}

interface PriceSubscription {
    type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
    contractIds: string[];
    clientId: string;
}

interface ClientSubscription {
    contractIds: Set<string>;
    lastSeen: number;
    subscribeToAll: boolean; // true if no specific contractIds provided
}

// Contract ID validation
function isValidContractId(contractId: string): boolean {
    if (!contractId || typeof contractId !== 'string') return false;

    // Native STX token
    if (contractId === '.stx' || contractId === 'stx') return true;

    // Standard contract format with optional trait
    const contractPattern = /^(SP|ST)[A-Z0-9]{38,39}\.[a-z0-9\-]+(::[a-z0-9\-]+)?$/;
    return contractPattern.test(contractId);
}

export default class PricesParty implements Party.Server {
    private subscriptions = new Map<string, ClientSubscription>();
    private latestPrices = new Map<string, PriceUpdate>();
    private watchedTokens = new Set<string>();
    private lastBroadcastedPrices = new Map<string, number>();

    // For local development only
    private localInterval: NodeJS.Timeout | null = null;
    private noiseInterval: NodeJS.Timeout | null = null;
    private isLocalDev = false;

    constructor(readonly room: Party.Room) {
        console.log(`🏠 Prices party room: ${this.room.id}`);

        // Detect if we're in local development
        this.isLocalDev = this.detectLocalDev();

        if (this.isLocalDev) {
            console.log('🛠️ Local development detected, using interval timer');
            this.startLocalInterval();
            this.startNoiseInterval();
        } else {
            console.log('☁️ Production detected, using alarms');
            // Set initial alarm for production
            this.room.storage.setAlarm(Date.now() + 60_000);
        }
        // Start noise interval in both dev and production
        this.startNoiseInterval();
    }

    private detectLocalDev(): boolean {
        try {
            // In production PartyKit, use alarms only. In dev, use intervals.
            // Check if we're running on localhost (port 1999 is dev server)
            return false; // Always use production mode (alarms) for now
        } catch {
            return false;
        }
    }

    private startLocalInterval() {
        console.log('🚀 Starting local interval setup...');

        if (this.localInterval) {
            clearInterval(this.localInterval);
        }

        this.localInterval = setInterval(async () => {
            console.log('🔄 [Local Dev] Running scheduled price update');
            await this.fetchAndBroadcastPrices();
        }, 60_000);

        setTimeout(async () => {
            console.log('⚡ Running immediate price update');
            await this.fetchAndBroadcastPrices();
        }, 2000);
    }

    private startNoiseInterval() {
        console.log('🎲 Starting price noise interval (every 100ms - 10x faster)');

        // Clear any existing noise interval
        if (this.noiseInterval) {
            clearInterval(this.noiseInterval);
        }

        // Add noise every 100ms (10x faster than 1 second)
        this.noiseInterval = setInterval(() => {
            this.addPriceNoise();
        }, 100);
    }

    private addPriceNoise() {
        if (this.latestPrices.size === 0) return;

        const priceEntries = Array.from(this.latestPrices.entries());
        const randomIndex = Math.floor(Math.random() * priceEntries.length);
        const [contractId, originalUpdate] = priceEntries[randomIndex]!;

        // Add small random noise: ±0.0000001% of the original price
        const noisePercent = (Math.random() - 0.5) * 0.000002; // ±0.0000001%
        const noisyPrice = originalUpdate.price * (1 + noisePercent);

        const noisyUpdate: PriceUpdate = {
            type: 'PRICE_UPDATE',
            contractId,
            price: noisyPrice,
            timestamp: Date.now(),
            source: 'noise'
        };

        this.latestPrices.set(contractId, noisyUpdate);
        this.room.broadcast(JSON.stringify(noisyUpdate));

        console.log(`🎲 Added noise to ${contractId}: ${originalUpdate.price} → ${noisyPrice} (${(noisePercent * 100).toFixed(8)}%)`);
    }

    onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
        const clientId = conn.id;
        console.log(`🔌 Client ${clientId} connected to prices party`);

        this.subscriptions.set(clientId, {
            contractIds: new Set(),
            lastSeen: Date.now(),
            subscribeToAll: false
        });

        // Send latest prices if available
        if (this.latestPrices.size > 0) {
            const prices = Array.from(this.latestPrices.values());
            conn.send(JSON.stringify({
                type: 'PRICE_BATCH',
                prices,
                timestamp: Date.now()
            }));
        }

        // Send server info
        conn.send(JSON.stringify({
            type: 'SERVER_INFO',
            party: 'prices',
            isLocalDev: this.isLocalDev,
            timestamp: Date.now()
        }));
    }

    onMessage(message: string, sender: Party.Connection) {
        try {
            const data = JSON.parse(message);
            const clientId = sender.id;

            switch (data.type) {
                case 'SUBSCRIBE':
                    this.handleSubscribe(data as PriceSubscription, clientId);
                    break;
                case 'UNSUBSCRIBE':
                    this.handleUnsubscribe(data as PriceSubscription, clientId);
                    break;
                case 'MANUAL_UPDATE':
                    console.log('🔄 Manual price update triggered');
                    this.fetchAndBroadcastPrices();
                    break;
                case 'PING':
                    sender.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp }));
                    break;
                default:
                    sender.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            sender.send(JSON.stringify({
                type: 'ERROR',
                message: 'Invalid message format'
            }));
        }
    }

    onClose(connection: Party.Connection) {
        const clientId = connection.id;
        console.log(`🔌 Client ${clientId} disconnected from prices party`);

        this.subscriptions.delete(clientId);
        this.cleanupWatchedTokens();

        if (this.isLocalDev && this.subscriptions.size === 0) {
            console.log('🛑 No more connections, pausing intervals');
            if (this.localInterval) {
                clearInterval(this.localInterval);
                this.localInterval = null;
            }
            if (this.noiseInterval) {
                clearInterval(this.noiseInterval);
                this.noiseInterval = null;
            }
        }
    }

    onRequest(request: Party.Request) {
        if (request.method === 'GET') {
            return this.handlePriceQuery(request);
        }
        if (request.method === 'POST') {
            console.log('🔄 External price update triggered');
            this.fetchAndBroadcastPrices();
            return new Response(JSON.stringify({
                status: 'triggered',
                party: 'prices',
                timestamp: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response('Method not allowed', { status: 405 });
    }

    async onAlarm() {
        console.log('⏰ [Production] Prices alarm triggered');
        try {
            await this.fetchAndBroadcastPrices();
            this.room.storage.setAlarm(Date.now() + 60_000);
        } catch (err) {
            console.error('[Prices Alarm] Failed:', err);
            this.room.storage.setAlarm(Date.now() + 60_000);
        }
    }

    private handleSubscribe(data: PriceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        // If no contractIds provided, subscribe to ALL
        if (!data.contractIds || data.contractIds.length === 0) {
            subscription.subscribeToAll = true;
            subscription.contractIds.clear();
            console.log(`📊 Client ${clientId} subscribed to ALL prices`);

            // Send all current prices
            if (this.latestPrices.size > 0) {
                const prices = Array.from(this.latestPrices.values());
                this.room.getConnection(clientId)?.send(JSON.stringify({
                    type: 'PRICE_BATCH',
                    prices,
                    timestamp: Date.now()
                }));
            }
            return;
        }

        // Subscribe to specific tokens
        subscription.subscribeToAll = false;
        const validContractIds = data.contractIds.filter(contractId => {
            if (!isValidContractId(contractId)) {
                console.warn(`Invalid contract ID from client ${clientId}: ${contractId}`);
                this.room.getConnection(clientId)?.send(JSON.stringify({
                    type: 'ERROR',
                    message: `Invalid contract ID format: ${contractId}`
                }));
                return false;
            }
            return true;
        });

        validContractIds.forEach(contractId => {
            subscription.contractIds.add(contractId);
            this.watchedTokens.add(contractId);

            // Send latest price if available
            const latestPrice = this.latestPrices.get(contractId);
            if (latestPrice) {
                this.room.getConnection(clientId)?.send(JSON.stringify(latestPrice));
            }
        });

        console.log(`📊 Client ${clientId} subscribed to ${validContractIds.length} specific prices`);

        // Restart intervals if needed
        if (this.isLocalDev && !this.localInterval && this.subscriptions.size > 0) {
            this.startLocalInterval();
        }
        if (!this.noiseInterval && this.subscriptions.size > 0) {
            this.startNoiseInterval();
        }
    }

    private handleUnsubscribe(data: PriceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        if (!data.contractIds || data.contractIds.length === 0) {
            // Unsubscribe from ALL
            subscription.subscribeToAll = false;
            subscription.contractIds.clear();
            console.log(`📊 Client ${clientId} unsubscribed from ALL prices`);
        } else {
            // Unsubscribe from specific tokens
            data.contractIds.forEach(contractId => {
                subscription.contractIds.delete(contractId);
            });
            console.log(`📊 Client ${clientId} unsubscribed from ${data.contractIds.length} prices`);
        }

        this.cleanupWatchedTokens();
    }

    private async handlePriceQuery(request: Party.Request) {
        const url = new URL(request.url);
        const contractIds = url.searchParams.get('tokens')?.split(',') || [];

        if (contractIds.length === 0) {
            const allPrices = Array.from(this.latestPrices.values());
            return new Response(JSON.stringify({
                prices: allPrices,
                party: 'prices',
                serverTime: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const requestedPrices = contractIds
            .map(id => this.latestPrices.get(id))
            .filter(Boolean);

        return new Response(JSON.stringify({
            prices: requestedPrices,
            party: 'prices',
            serverTime: Date.now()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private cleanupWatchedTokens() {
        const activeTokens = new Set<string>();
        this.subscriptions.forEach(subscription => {
            if (subscription.subscribeToAll) {
                // If anyone subscribes to all, we need to watch everything we have
                this.latestPrices.forEach((_, contractId) => {
                    activeTokens.add(contractId);
                });
            } else {
                subscription.contractIds.forEach(contractId => {
                    activeTokens.add(contractId);
                });
            }
        });

        this.watchedTokens = activeTokens;
    }

    private async fetchAndBroadcastPrices() {
        try {
            const prices = await listPrices();
            const now = Date.now();
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';

            console.log(`💰 ${source} Fetched ${Object.keys(prices).length} prices from API`);

            let newPrices = 0;
            let updatedPrices = 0;
            let unchangedPrices = 0;
            const newTokens: string[] = [];
            const updatedTokens: string[] = [];

            for (const [contractId, price] of Object.entries(prices)) {
                if (typeof price !== 'number' || isNaN(price)) {
                    console.warn(`⚠️ Invalid price for ${contractId}: ${price}`);
                    continue;
                }

                const prev = this.lastBroadcastedPrices.get(contractId);
                const isNewToken = prev === undefined;
                const hasChanged = prev !== price;

                if (!hasChanged && !isNewToken) {
                    unchangedPrices++;
                    continue; // Only broadcast if changed or new
                }

                const update: PriceUpdate = {
                    type: 'PRICE_UPDATE',
                    contractId,
                    price,
                    timestamp: now,
                    source: this.isLocalDev ? 'local-dev' : 'production'
                };

                this.latestPrices.set(contractId, update);
                this.lastBroadcastedPrices.set(contractId, price);

                // Send to all clients
                this.room.broadcast(JSON.stringify(update));

                if (isNewToken) {
                    newPrices++;
                    newTokens.push(contractId);
                } else {
                    updatedPrices++;
                    updatedTokens.push(contractId);
                    console.log(`📈 ${contractId}: ${prev} → ${price} (${((price - prev) / prev * 100).toFixed(4)}%)`);
                }
            }

            // Summary log
            console.log(`📊 ${source} Batch Summary:`);
            console.log(`   • ${newPrices} new tokens${newTokens.length > 0 ? ': ' + newTokens.slice(0, 3).join(', ') + (newTokens.length > 3 ? '...' : '') : ''}`);
            console.log(`   • ${updatedPrices} price changes${updatedTokens.length > 0 ? ': ' + updatedTokens.slice(0, 3).join(', ') + (updatedTokens.length > 3 ? '...' : '') : ''}`);
            console.log(`   • ${unchangedPrices} unchanged prices`);
            console.log(`   → Broadcasted ${newPrices + updatedPrices} updates total`);

        } catch (err) {
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';
            console.error(`${source} Prices: Failed to fetch/broadcast:`, err);
        }
    }
}

PricesParty satisfies Party.Worker;