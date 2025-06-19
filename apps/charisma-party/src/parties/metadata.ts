import type * as Party from "partykit/server";
import { fetchMetadata } from "@repo/tokens";

interface TokenMetadata {
    contractId: string;
    name: string;
    symbol: string;
    decimals: number;
    description?: string;
    image?: string;
    totalSupply?: string;
    lastUpdated: number;
}

interface MetadataUpdate {
    type: 'METADATA_UPDATE';
    contractId: string;
    metadata: TokenMetadata;
    timestamp: number;
    source?: string;
}

interface MetadataSubscription {
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

export default class MetadataParty implements Party.Server {
    private subscriptions = new Map<string, ClientSubscription>();
    private latestMetadata = new Map<string, MetadataUpdate>();
    private watchedTokens = new Set<string>();

    // Metadata refresh interval (less frequent than prices)
    private localInterval: NodeJS.Timeout | null = null;
    private isLocalDev = false;

    constructor(readonly room: Party.Room) {
        console.log(`🏠 Metadata party room: ${this.room.id}`);

        // Detect if we're in local development
        this.isLocalDev = this.detectLocalDev();

        if (this.isLocalDev) {
            console.log('🛠️ Metadata: Local development detected');
            this.startLocalInterval();
        } else {
            console.log('☁️ Metadata: Production detected, using alarms');
            // Set initial alarm for production (less frequent than prices)
            this.room.storage.setAlarm(Date.now() + 300_000); // 5 minutes
        }
    }

    private detectLocalDev(): boolean {
        try {
            const isDev = process.env.NODE_ENV === 'development';
            return isDev;
        } catch {
            return false;
        }
    }

    private startLocalInterval() {
        console.log('🚀 Metadata: Starting local interval setup...');

        if (this.localInterval) {
            clearInterval(this.localInterval);
        }

        // Metadata refreshes less frequently - every 5 minutes
        this.localInterval = setInterval(async () => {
            console.log('🔄 [Local Dev] Running scheduled metadata update');
            await this.fetchAndBroadcastMetadata();
        }, 300_000);

        // Run immediately for development
        setTimeout(async () => {
            console.log('⚡ Running immediate metadata update');
            await this.fetchAndBroadcastMetadata();
        }, 3000);
    }

    onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
        const clientId = conn.id;
        console.log(`🔌 Client ${clientId} connected to metadata party`);

        this.subscriptions.set(clientId, {
            contractIds: new Set(),
            lastSeen: Date.now(),
            subscribeToAll: false
        });

        // Send latest metadata if available
        if (this.latestMetadata.size > 0) {
            const metadata = Array.from(this.latestMetadata.values());
            conn.send(JSON.stringify({
                type: 'METADATA_BATCH',
                metadata,
                timestamp: Date.now()
            }));
        }

        // Send server info
        conn.send(JSON.stringify({
            type: 'SERVER_INFO',
            party: 'metadata',
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
                    this.handleSubscribe(data as MetadataSubscription, clientId);
                    break;
                case 'UNSUBSCRIBE':
                    this.handleUnsubscribe(data as MetadataSubscription, clientId);
                    break;
                case 'MANUAL_UPDATE':
                    console.log('🔄 Manual metadata update triggered');
                    this.fetchAndBroadcastMetadata();
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
        console.log(`🔌 Client ${clientId} disconnected from metadata party`);

        this.subscriptions.delete(clientId);
        this.cleanupWatchedTokens();

        if (this.isLocalDev && this.subscriptions.size === 0) {
            console.log('🛑 No more connections, pausing metadata interval');
            if (this.localInterval) {
                clearInterval(this.localInterval);
                this.localInterval = null;
            }
        }
    }

    onRequest(request: Party.Request) {
        if (request.method === 'GET') {
            return this.handleMetadataQuery(request);
        }
        if (request.method === 'POST') {
            console.log('🔄 External metadata update triggered');
            this.fetchAndBroadcastMetadata();
            return new Response(JSON.stringify({
                status: 'triggered',
                party: 'metadata',
                timestamp: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response('Method not allowed', { status: 405 });
    }

    async onAlarm() {
        console.log('⏰ [Production] Metadata alarm triggered');
        try {
            await this.fetchAndBroadcastMetadata();
            // Schedule next alarm (5 minutes)
            this.room.storage.setAlarm(Date.now() + 300_000);
        } catch (err) {
            console.error('[Metadata Alarm] Failed:', err);
            this.room.storage.setAlarm(Date.now() + 300_000);
        }
    }

    private handleSubscribe(data: MetadataSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        // If no contractIds provided, subscribe to ALL
        if (!data.contractIds || data.contractIds.length === 0) {
            subscription.subscribeToAll = true;
            subscription.contractIds.clear();
            console.log(`🏷️ Client ${clientId} subscribed to ALL metadata`);

            // Send all current metadata
            if (this.latestMetadata.size > 0) {
                const metadata = Array.from(this.latestMetadata.values());
                this.room.getConnection(clientId)?.send(JSON.stringify({
                    type: 'METADATA_BATCH',
                    metadata,
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

            // Send latest metadata if available
            const latestMetadata = this.latestMetadata.get(contractId);
            if (latestMetadata) {
                this.room.getConnection(clientId)?.send(JSON.stringify(latestMetadata));
            }
        });

        console.log(`🏷️ Client ${clientId} subscribed to ${validContractIds.length} specific metadata`);

        // Restart interval if needed
        if (this.isLocalDev && !this.localInterval && this.subscriptions.size > 0) {
            this.startLocalInterval();
        }
    }

    private handleUnsubscribe(data: MetadataSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        if (!data.contractIds || data.contractIds.length === 0) {
            // Unsubscribe from ALL
            subscription.subscribeToAll = false;
            subscription.contractIds.clear();
            console.log(`🏷️ Client ${clientId} unsubscribed from ALL metadata`);
        } else {
            // Unsubscribe from specific tokens
            data.contractIds.forEach(contractId => {
                subscription.contractIds.delete(contractId);
            });
            console.log(`🏷️ Client ${clientId} unsubscribed from ${data.contractIds.length} metadata`);
        }

        this.cleanupWatchedTokens();
    }

    private async handleMetadataQuery(request: Party.Request) {
        const url = new URL(request.url);
        const contractIds = url.searchParams.get('tokens')?.split(',') || [];

        if (contractIds.length === 0) {
            const allMetadata = Array.from(this.latestMetadata.values());
            return new Response(JSON.stringify({
                metadata: allMetadata,
                party: 'metadata',
                serverTime: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const requestedMetadata = contractIds
            .map(id => this.latestMetadata.get(id))
            .filter(Boolean);

        return new Response(JSON.stringify({
            metadata: requestedMetadata,
            party: 'metadata',
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
                this.latestMetadata.forEach((_, contractId) => {
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

    private async fetchAndBroadcastMetadata() {
        try {
            console.log(`🏷️ Fetching metadata from token cache API`);
            const metadataList = await fetchMetadata();
            const now = Date.now();
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';

            console.log(`🏷️ ${source} Fetched ${metadataList.length} metadata entries from API`);

            let newMetadata = 0;
            let updatedMetadata = 0;
            let unchangedMetadata = 0;

            // Process metadata from API response
            for (const metadata of metadataList) {
                if (!metadata.contractId) {
                    console.warn('⚠️ Metadata entry missing contractId:', metadata);
                    continue;
                }

                const contractId = metadata.contractId;

                // Only process if we're watching this token (or watching all)
                const shouldProcess = this.subscriptions.size === 0 || // No subscriptions yet, process all
                    Array.from(this.subscriptions.values()).some(sub =>
                        sub.subscribeToAll || sub.contractIds.has(contractId)
                    );

                if (!shouldProcess) {
                    unchangedMetadata++;
                    continue;
                }

                const update: MetadataUpdate = {
                    type: 'METADATA_UPDATE',
                    contractId,
                    metadata: {
                        contractId,
                        name: metadata.name || `Token ${contractId}`,
                        symbol: metadata.symbol || 'TKN',
                        decimals: metadata.decimals || 6,
                        description: metadata.description,
                        image: metadata.image,
                        totalSupply: metadata.total_supply,
                        lastUpdated: now
                    },
                    timestamp: now,
                    source: this.isLocalDev ? 'local-dev' : 'production'
                };

                const prev = this.latestMetadata.get(contractId);
                const isNewMetadata = prev === undefined;
                const hasChanged = !prev ||
                    prev.metadata.name !== update.metadata.name ||
                    prev.metadata.symbol !== update.metadata.symbol ||
                    prev.metadata.image !== update.metadata.image ||
                    prev.metadata.totalSupply !== update.metadata.totalSupply;

                if (!hasChanged && !isNewMetadata) {
                    unchangedMetadata++;
                    continue; // Only broadcast if changed or new
                }

                this.latestMetadata.set(contractId, update);

                // Send to all clients
                this.room.broadcast(JSON.stringify(update));

                if (isNewMetadata) {
                    newMetadata++;
                } else {
                    updatedMetadata++;
                    console.log(`🏷️ ${contractId}: ${prev?.metadata.name} → ${update.metadata.name}`);
                }
            }

            // Summary log
            console.log(`📊 ${source} Metadata Summary:`);
            console.log(`   • ${newMetadata} new metadata entries`);
            console.log(`   • ${updatedMetadata} metadata changes`);
            console.log(`   • ${unchangedMetadata} unchanged metadata`);
            console.log(`   → Broadcasted ${newMetadata + updatedMetadata} updates total`);

        } catch (err) {
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';
            console.error(`${source} Metadata: Failed to fetch/broadcast:`, err);
        }
    }

    // Method to receive metadata updates (called externally)
    updateMetadata(contractId: string, metadata: TokenMetadata, source = 'external') {
        const update: MetadataUpdate = {
            type: 'METADATA_UPDATE',
            contractId,
            metadata: {
                ...metadata,
                contractId,
                lastUpdated: Date.now()
            },
            timestamp: Date.now(),
            source
        };

        this.latestMetadata.set(contractId, update);
        this.room.broadcast(JSON.stringify(update));

        console.log(`🏷️ Updated metadata: ${contractId}`);
    }
}

MetadataParty satisfies Party.Worker;