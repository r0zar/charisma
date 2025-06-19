import type * as Party from "partykit/server";
import { fetchUserBalances } from "../balances-lib";

interface BalanceUpdate {
    type: 'BALANCE_UPDATE';
    userId: string;
    contractId: string;
    balance: string;
    totalSent: string;
    totalReceived: string;
    timestamp: number;
    source: string;
}

interface BalanceSubscription {
    type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
    userIds: string[];
    clientId: string;
}

interface ClientSubscription {
    userIds: Set<string>;
    lastSeen: number;
    subscribeToAll: boolean; // true if no specific userIds provided
}

// User address validation
function isValidUserAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    
    // Standard Stacks address format
    const addressPattern = /^(SP|ST)[A-Z0-9]{38,39}$/;
    return addressPattern.test(address);
}

export default class BalancesParty implements Party.Server {
    private subscriptions = new Map<string, ClientSubscription>();
    private latestBalances = new Map<string, BalanceUpdate>();
    private watchedUsers = new Set<string>();

    // For local development only
    private localInterval: NodeJS.Timeout | null = null;
    private isLocalDev = false;

    constructor(readonly room: Party.Room) {
        console.log(`💰 Balances party room: ${this.room.id}`);

        // Detect if we're in local development
        this.isLocalDev = this.detectLocalDev();

        if (this.isLocalDev) {
            console.log('🛠️ Local development detected, using interval timer');
            this.startLocalInterval();
        } else {
            console.log('☁️ Production detected, using alarms');
            // Set initial alarm for production (every 5 minutes for balances)
            this.room.storage.setAlarm(Date.now() + 300_000);
        }
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
        console.log('🚀 Starting local balance interval setup...');

        if (this.localInterval) {
            clearInterval(this.localInterval);
        }

        // Check balances every 5 minutes in dev
        this.localInterval = setInterval(async () => {
            console.log('🔄 [Local Dev] Running scheduled balance update');
            await this.fetchAndBroadcastBalances();
        }, 300_000);

        // Initial fetch after 3 seconds
        setTimeout(async () => {
            console.log('⚡ Running immediate balance update');
            await this.fetchAndBroadcastBalances();
        }, 3000);
    }

    onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
        const clientId = conn.id;
        console.log(`🔌 Client ${clientId} connected to balances party`);

        this.subscriptions.set(clientId, {
            userIds: new Set(),
            lastSeen: Date.now(),
            subscribeToAll: false
        });

        // Send latest balances if available
        if (this.latestBalances.size > 0) {
            const balances = Array.from(this.latestBalances.values());
            conn.send(JSON.stringify({
                type: 'BALANCE_BATCH',
                balances,
                timestamp: Date.now()
            }));
        }

        // Send server info
        conn.send(JSON.stringify({
            type: 'SERVER_INFO',
            party: 'balances',
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
                    this.handleSubscribe(data as BalanceSubscription, clientId);
                    break;
                case 'UNSUBSCRIBE':
                    this.handleUnsubscribe(data as BalanceSubscription, clientId);
                    break;
                case 'MANUAL_UPDATE':
                    console.log('🔄 Manual balance update triggered');
                    this.fetchAndBroadcastBalances();
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
        console.log(`🔌 Client ${clientId} disconnected from balances party`);

        this.subscriptions.delete(clientId);
        this.cleanupWatchedUsers();

        if (this.isLocalDev && this.subscriptions.size === 0) {
            console.log('🛑 No more connections, pausing intervals');
            if (this.localInterval) {
                clearInterval(this.localInterval);
                this.localInterval = null;
            }
        }
    }

    onRequest(request: Party.Request) {
        if (request.method === 'GET') {
            return this.handleBalanceQuery(request);
        }
        if (request.method === 'POST') {
            console.log('🔄 External balance update triggered');
            this.fetchAndBroadcastBalances();
            return new Response(JSON.stringify({
                status: 'triggered',
                party: 'balances',
                timestamp: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response('Method not allowed', { status: 405 });
    }

    async onAlarm() {
        console.log('⏰ [Production] Balances alarm triggered');
        try {
            await this.fetchAndBroadcastBalances();
            // Set next alarm for 5 minutes
            this.room.storage.setAlarm(Date.now() + 300_000);
        } catch (err) {
            console.error('[Balances Alarm] Failed:', err);
            this.room.storage.setAlarm(Date.now() + 300_000);
        }
    }

    private handleSubscribe(data: BalanceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        // If no userIds provided, subscribe to ALL watched users
        if (!data.userIds || data.userIds.length === 0) {
            subscription.subscribeToAll = true;
            subscription.userIds.clear();
            console.log(`💰 Client ${clientId} subscribed to ALL user balances`);
            
            // Send all current balances
            if (this.latestBalances.size > 0) {
                const balances = Array.from(this.latestBalances.values());
                this.room.getConnection(clientId)?.send(JSON.stringify({
                    type: 'BALANCE_BATCH',
                    balances,
                    timestamp: Date.now()
                }));
            }
            return;
        }

        // Subscribe to specific users
        subscription.subscribeToAll = false;
        const validUserIds = data.userIds.filter(userId => {
            if (!isValidUserAddress(userId)) {
                console.warn(`Invalid user address from client ${clientId}: ${userId}`);
                this.room.getConnection(clientId)?.send(JSON.stringify({
                    type: 'ERROR',
                    message: `Invalid user address format: ${userId}`
                }));
                return false;
            }
            return true;
        });

        validUserIds.forEach(userId => {
            subscription.userIds.add(userId);
            this.watchedUsers.add(userId);

            // Send latest balances for this user if available
            this.latestBalances.forEach((balance) => {
                if (balance.userId === userId) {
                    this.room.getConnection(clientId)?.send(JSON.stringify(balance));
                }
            });
        });

        console.log(`💰 Client ${clientId} subscribed to ${validUserIds.length} specific user balances`);

        // Restart intervals if needed
        if (this.isLocalDev && !this.localInterval && this.subscriptions.size > 0) {
            this.startLocalInterval();
        }
    }

    private handleUnsubscribe(data: BalanceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        if (!data.userIds || data.userIds.length === 0) {
            // Unsubscribe from ALL
            subscription.subscribeToAll = false;
            subscription.userIds.clear();
            console.log(`💰 Client ${clientId} unsubscribed from ALL user balances`);
        } else {
            // Unsubscribe from specific users
            data.userIds.forEach(userId => {
                subscription.userIds.delete(userId);
            });
            console.log(`💰 Client ${clientId} unsubscribed from ${data.userIds.length} user balances`);
        }

        this.cleanupWatchedUsers();
    }

    private async handleBalanceQuery(request: Party.Request) {
        const url = new URL(request.url);
        const userIds = url.searchParams.get('users')?.split(',') || [];

        if (userIds.length === 0) {
            const allBalances = Array.from(this.latestBalances.values());
            return new Response(JSON.stringify({
                balances: allBalances,
                party: 'balances',
                serverTime: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const requestedBalances = Array.from(this.latestBalances.values())
            .filter(balance => userIds.includes(balance.userId));

        return new Response(JSON.stringify({
            balances: requestedBalances,
            party: 'balances',
            serverTime: Date.now()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private cleanupWatchedUsers() {
        const activeUsers = new Set<string>();
        this.subscriptions.forEach(subscription => {
            if (subscription.subscribeToAll) {
                // If anyone subscribes to all, we need to watch all users we have data for
                this.latestBalances.forEach((balance) => {
                    activeUsers.add(balance.userId);
                });
            } else {
                subscription.userIds.forEach(userId => {
                    activeUsers.add(userId);
                });
            }
        });

        this.watchedUsers = activeUsers;
    }

    private async fetchAndBroadcastBalances() {
        if (this.watchedUsers.size === 0) {
            console.log('💰 No users to watch, skipping balance fetch');
            return;
        }

        try {
            const userIds = Array.from(this.watchedUsers);
            const balanceUpdates = await fetchUserBalances(userIds);
            const now = Date.now();
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';
            
            console.log(`💰 ${source} Fetched balances for ${userIds.length} users, got ${Object.keys(balanceUpdates).length} balance entries`);
            
            let newBalances = 0;
            let updatedBalances = 0;
            let unchangedBalances = 0;

            for (const [key, balanceData] of Object.entries(balanceUpdates)) {
                const update: BalanceUpdate = {
                    type: 'BALANCE_UPDATE',
                    userId: balanceData.userId,
                    contractId: balanceData.contractId,
                    balance: balanceData.balance,
                    totalSent: balanceData.totalSent,
                    totalReceived: balanceData.totalReceived,
                    timestamp: now,
                    source: balanceData.source
                };

                const prev = this.latestBalances.get(key);
                const isNewBalance = prev === undefined;
                const hasChanged = prev?.balance !== update.balance || 
                                 prev?.totalSent !== update.totalSent || 
                                 prev?.totalReceived !== update.totalReceived;

                if (!hasChanged && !isNewBalance) {
                    unchangedBalances++;
                    continue; // Only broadcast if changed or new
                }

                this.latestBalances.set(key, update);
                
                // Send to all clients
                this.room.broadcast(JSON.stringify(update));

                if (isNewBalance) {
                    newBalances++;
                } else {
                    updatedBalances++;
                    console.log(`💰 ${update.userId}:${update.contractId} balance: ${prev?.balance} → ${update.balance}`);
                }
            }

            // Summary log
            console.log(`📊 ${source} Balance Summary:`);;
            console.log(`   • ${newBalances} new balance entries`);
            console.log(`   • ${updatedBalances} balance changes`);
            console.log(`   • ${unchangedBalances} unchanged balances`);
            console.log(`   → Broadcasted ${newBalances + updatedBalances} updates total`);

        } catch (err) {
            const source = this.isLocalDev ? '[Local Dev]' : '[Production]';
            console.error(`${source} Balances: Failed to fetch/broadcast:`, err);
        }
    }
}

BalancesParty satisfies Party.Worker;