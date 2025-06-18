import type * as Party from "partykit/server";
import { listPrices } from "./prices-lib";

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

export default class PriceServer implements Party.Server {
    private subscriptions = new Map<string, ClientSubscription>();
    private latestPrices = new Map<string, PriceUpdate>();
    private watchedTokens = new Set<string>();
    private lastBroadcastedPrices = new Map<string, number>();

    // For local development only
    private localInterval: NodeJS.Timeout | null = null;
    private isLocalDev = false;

    constructor(readonly room: Party.Room) {
        console.log(`🏠 Price server room: ${this.room.id}`);

        // Detect if we're in local development
        this.isLocalDev = this.detectLocalDev();

        if (this.isLocalDev) {
            console.log('🛠️ Local development detected, using interval timer');
            this.startLocalInterval();
        } else {
            console.log('☁️ Production detected, using alarms');
            // Set initial alarm for production
            this.room.storage.setAlarm(Date.now() + 60_000);
        }
    }

    private detectLocalDev(): boolean {
        // Multiple ways to detect local development
        try {
            const isDev = process.env.NODE_ENV === 'development';
            return isDev;
        } catch {
            // If we can't determine, assume production
            return false;
        }
    }

    private startLocalInterval() {
        console.log('🚀 Starting local interval setup...');

        // Clear any existing interval
        if (this.localInterval) {
            console.log('🧹 Clearing existing interval');
            clearInterval(this.localInterval);
        }

        // Start interval for local development (60 seconds)
        console.log('⏱️ Setting up 60-second interval');
        this.localInterval = setInterval(async () => {
            console.log('🔄 [Local Dev] Running scheduled price update');
            await this.fetchAndBroadcastPrices();
        }, 60_000);

        // Also run immediately for faster development feedback
        console.log('⚡ Scheduling immediate price update in 2 seconds...');
        setTimeout(async () => {
            console.log('⚡ Running immediate price update');
            await this.fetchAndBroadcastPrices();
        }, 2000);

        console.log('✅ Local interval setup complete');
    }

    onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
        const clientId = conn.id;
        console.log(`🔌 Client ${clientId} connected to price server`);

        this.subscriptions.set(clientId, {
            contractIds: new Set(),
            lastSeen: Date.now()
        });

        if (this.latestPrices.size > 0) {
            const prices = Array.from(this.latestPrices.values());
            conn.send(JSON.stringify({
                type: 'PRICE_BATCH',
                prices,
                timestamp: Date.now()
            }));
        }

        // Send environment info to client for debugging
        conn.send(JSON.stringify({
            type: 'SERVER_INFO',
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
                    // Allow manual price updates for testing
                    console.log('🔄 Manual price update triggered');
                    this.fetchAndBroadcastPrices();
                    break;
                case 'HEARTBEAT':
                    sender.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
                    break;
                case 'PING':
                    // Respond to latency pings with a PONG and the original timestamp
                    sender.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp }));
                    break;
                default:
                    sender.send(JSON.stringify({
                        type: 'ERROR',
                        message: 'Unknown or unsupported message type'
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
        console.log(`🔌 Client ${clientId} disconnected from price server`);

        this.subscriptions.delete(clientId);
        this.cleanupWatchedTokens();

        // If no more connections in local dev, clear interval to save resources
        if (this.isLocalDev && this.subscriptions.size === 0) {
            console.log('🛑 No more connections, pausing local interval');
            if (this.localInterval) {
                clearInterval(this.localInterval);
                this.localInterval = null;
            }
        }
    }

    onRequest(request: Party.Request) {
        if (request.method === 'GET') {
            return this.handlePriceQuery(request);
        }
        if (request.method === 'POST') {
            // Allow external triggers
            console.log('🔄 External price update triggered');
            this.fetchAndBroadcastPrices();
            return new Response(JSON.stringify({
                status: 'triggered',
                isLocalDev: this.isLocalDev,
                timestamp: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response('Method not allowed', { status: 405 });
    }

    // Production alarm handler
    async onAlarm() {
        console.log('⏰ [Production] Alarm triggered - fetching prices');
        try {
            await this.fetchAndBroadcastPrices();
            // Schedule next alarm
            this.room.storage.setAlarm(Date.now() + 60_000);
        } catch (err) {
            console.error('[Alarm] Failed to fetch/broadcast prices:', err);
            // Still schedule next alarm
            this.room.storage.setAlarm(Date.now() + 60_000);
        }
    }

    private handleSubscribe(data: PriceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        // Validate contract IDs
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

            const latestPrice = this.latestPrices.get(contractId);
            if (latestPrice) {
                this.room.getConnection(clientId)?.send(JSON.stringify(latestPrice));
            }
        });

        console.log(`📊 Client ${clientId} subscribed to ${validContractIds.length} tokens`);
        console.log(`📊 Total watched tokens: ${this.watchedTokens.size}`);

        // Restart local interval if we have subscribers and it's not running
        if (this.isLocalDev && !this.localInterval && this.subscriptions.size > 0) {
            console.log('🔄 Restarting local interval (new subscriber)');
            this.startLocalInterval();
        }
    }

    private handleUnsubscribe(data: PriceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        data.contractIds.forEach(contractId => {
            subscription.contractIds.delete(contractId);
        });

        this.cleanupWatchedTokens();
        console.log(`📊 Client ${clientId} unsubscribed from ${data.contractIds.length} tokens`);
    }

    private async handlePriceQuery(request: Party.Request) {
        const url = new URL(request.url);
        const contractIds = url.searchParams.get('tokens')?.split(',') || [];

        if (contractIds.length === 0) {
            const allPrices = Array.from(this.latestPrices.values());
            return new Response(JSON.stringify({
                prices: allPrices,
                isLocalDev: this.isLocalDev,
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
            isLocalDev: this.isLocalDev,
            serverTime: Date.now()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private cleanupWatchedTokens() {
        const activeTokens = new Set<string>();
        this.subscriptions.forEach(subscription => {
            subscription.contractIds.forEach(contractId => {
                activeTokens.add(contractId);
            });
        });

        this.watchedTokens = activeTokens;
    }

    private async fetchAndBroadcastPrices() {
        try {
            const prices = await listPrices();
            console.log(`💰 Fetched ${Object.keys(prices).length} prices`);
            const now = Date.now();
            let broadcasted = 0;

            for (const [contractId, price] of Object.entries(prices)) {
                if (typeof price !== 'number' || isNaN(price)) continue;

                const prev = this.lastBroadcastedPrices.get(contractId);
                if (prev === price) continue; // Only broadcast if changed

                const update: PriceUpdate = {
                    type: 'PRICE_UPDATE',
                    contractId,
                    price,
                    timestamp: now,
                    source: this.isLocalDev ? 'local-dev' : 'production'
                };

                this.latestPrices.set(contractId, update);
                this.lastBroadcastedPrices.set(contractId, price);
                this.room.broadcast(JSON.stringify(update));
                broadcasted++;
            }

            if (broadcasted > 0) {
                const source = this.isLocalDev ? '[Local Dev]' : '[Production]';
                console.log(`${source} Broadcasted ${broadcasted} price updates at ${new Date(now).toISOString()}`);
            }
        } catch (err) {
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';
            console.error(`${source} Failed to fetch/broadcast prices:`, err);
        }
    }
}

PriceServer satisfies Party.Worker;