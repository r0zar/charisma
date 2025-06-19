import type * as Party from "partykit/server";
import {
    fetchUserBalances,
    loadTokenMetadata,
    formatBalance,
    createBalanceUpdateMessage,
    isValidUserAddress,
    type EnhancedTokenRecord
} from "../balances-lib";
import type { BalanceUpdateMessage } from "blaze-sdk/realtime";

interface BalanceSubscription {
    type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
    userIds: string[];
    clientId: string;
}

interface ClientSubscription {
    userIds: Set<string>;
    lastSeen: number;
    subscribeToAll: boolean;
}

// Simple balance data structure - one entry per mainnet token per user
interface TokenBalance {
    userId: string;
    mainnetContractId: string;
    mainnetBalance: number;
    mainnetTotalSent: string;
    mainnetTotalReceived: string;
    subnetBalance?: number;
    subnetTotalSent?: string;
    subnetTotalReceived?: string;
    subnetContractId?: string;
    lastUpdated: number;
}

// Constants
const BALANCE_UPDATE_INTERVAL = 300_000; // 5 minutes
const INITIAL_FETCH_DELAY = 3_000; // 3 seconds
const DEFAULT_DECIMALS = 6;
const SUBNET_TOKEN_TYPE = 'SUBNET';

export default class BalancesParty implements Party.Server {
    private subscriptions = new Map<string, ClientSubscription>();
    private tokenRecords = new Map<string, EnhancedTokenRecord>();
    private watchedUsers = new Set<string>();

    // SINGLE source of truth: `${userId}:${mainnetContractId}` -> TokenBalance
    private balances = new Map<string, TokenBalance>();

    private localInterval: NodeJS.Timeout | null = null;
    private isLocalDev = false;

    // Helper methods for contract ID handling
    private getBaseContractId(contractId: string): string {
        return contractId.split('::')[0]!;
    }

    private findTokenRecord(contractId: string): EnhancedTokenRecord | undefined {
        // Try exact match first
        let record = this.tokenRecords.get(contractId);
        if (record) return record;

        // Try base contract if contractId has identifier
        if (contractId.includes('::')) {
            const baseContractId = this.getBaseContractId(contractId);
            record = this.tokenRecords.get(baseContractId);
            if (record) {
                console.log(`🔄 Found token record for ${contractId} using base contract ${baseContractId}`);
                return record;
            }
        }

        return undefined;
    }

    private validateTokenRecord(tokenRecord: EnhancedTokenRecord, contractId: string): boolean {
        const isSubnet = tokenRecord.tokenType === SUBNET_TOKEN_TYPE;

        if (isSubnet) {
            if (!tokenRecord.baseToken) {
                console.warn(`⚠️ Subnet token ${contractId} missing baseToken`);
                return false;
            }

            if (!this.tokenRecords.has(tokenRecord.baseToken)) {
                console.warn(`⚠️ Subnet token ${contractId} has invalid baseToken: ${tokenRecord.baseToken}`);
                return false;
            }
        }

        return true;
    }

    private getOrCreateFallbackRecord(contractId: string): EnhancedTokenRecord {
        let record = this.tokenRecords.get(contractId);
        if (record) return record;

        console.error(`❌ No token record found for ${contractId}, creating fallback`);

        // Create a fallback record to prevent crashes
        const fallbackRecord: EnhancedTokenRecord = {
            contractId: contractId,
            name: `Unknown Token ${contractId}`,
            symbol: 'UNKNOWN',
            decimals: DEFAULT_DECIMALS,
            description: null,
            image: null,
            total_supply: null,
            tokenType: 'SIP10',
            identifier: '',
            token_uri: null,
            lastUpdated: Date.now(),
            tokenAContract: null,
            tokenBContract: null,
            lpRebatePercent: null,
            externalPoolId: null,
            engineContractId: null,
            baseToken: null,
            userBalances: {},
            timestamp: Date.now(),
            metadataSource: 'fallback'
        };

        // Cache the fallback record to avoid repeated errors
        this.tokenRecords.set(contractId, fallbackRecord);
        return fallbackRecord;
    }

    constructor(readonly room: Party.Room) {
        console.log(`💰 Balances party room: ${this.room.id}`);
        this.isLocalDev = this.detectLocalDev();
        this.loadTokenMetadata();

        if (this.isLocalDev) {
            this.startLocalInterval();
        } else {
            this.room.storage.setAlarm(Date.now() + BALANCE_UPDATE_INTERVAL);
        }
    }

    private detectLocalDev(): boolean {
        try {
            // Check if we're running on localhost (port 1999 is dev server)
            // In PartyKit, we can detect dev environment by checking the hostname
            return process.env.NODE_ENV === 'development' ||
                process.env.PARTYKIT_ENV === 'development' ||
                (typeof globalThis !== 'undefined' &&
                    globalThis.location?.hostname === 'localhost');
        } catch {
            return false;
        }
    }

    private startLocalInterval() {
        if (this.localInterval) clearInterval(this.localInterval);

        this.localInterval = setInterval(() => {
            this.fetchAndBroadcastBalances();
        }, BALANCE_UPDATE_INTERVAL);

        setTimeout(() => {
            this.fetchAndBroadcastBalances();
        }, INITIAL_FETCH_DELAY);
    }

    private async loadTokenMetadata() {
        try {
            this.tokenRecords = await loadTokenMetadata();
            console.log(`🏷️ Loaded ${this.tokenRecords.size} token records`);
        } catch (error) {
            console.error('🏷️ Failed to load token metadata:', error);
        }
    }

    onConnect(conn: Party.Connection) {
        const clientId = conn.id;
        console.log(`🔌 Client ${clientId} connected`);

        this.subscriptions.set(clientId, {
            userIds: new Set(),
            lastSeen: Date.now(),
            subscribeToAll: false
        });

        // Send all cached balances
        const messages = this.createAllBalanceMessages();
        if (messages.length > 0) {
            conn.send(JSON.stringify({
                type: 'BALANCE_BATCH',
                balances: messages,
                timestamp: Date.now()
            }));
        }

        // Send server info
        conn.send(JSON.stringify({
            type: 'SERVER_INFO',
            party: 'balances',
            isLocalDev: this.isLocalDev,
            metadataLoaded: this.tokenRecords.size > 0,
            metadataCount: this.tokenRecords.size,
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
                    this.fetchAndBroadcastBalances();
                    break;
                case 'REFRESH_METADATA':
                    this.loadTokenMetadata();
                    break;
                case 'PING':
                    sender.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp }));
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
        this.cleanupWatchedUsers();

        if (this.isLocalDev && this.subscriptions.size === 0) {
            if (this.localInterval) {
                clearInterval(this.localInterval);
                this.localInterval = null;
            }
        }
    }

    onRequest(request: Party.Request) {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const userIds = url.searchParams.get('users')?.split(',') || [];

            const messages = userIds.length === 0
                ? this.createAllBalanceMessages()
                : this.createBalanceMessagesForUsers(userIds);

            return new Response(JSON.stringify({
                balances: messages,
                party: 'balances',
                serverTime: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (request.method === 'POST') {
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
        console.log('⏰ Balances alarm triggered');
        try {
            await this.fetchAndBroadcastBalances();
            this.room.storage.setAlarm(Date.now() + BALANCE_UPDATE_INTERVAL);
        } catch (err) {
            console.error('Balances alarm failed:', err);
            this.room.storage.setAlarm(Date.now() + BALANCE_UPDATE_INTERVAL);
        }
    }

    private handleSubscribe(data: BalanceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        if (!data.userIds || data.userIds.length === 0) {
            subscription.subscribeToAll = true;
            subscription.userIds.clear();

            const messages = this.createAllBalanceMessages();
            this.room.getConnection(clientId)?.send(JSON.stringify({
                type: 'BALANCE_BATCH',
                balances: messages,
                timestamp: Date.now()
            }));
            return;
        }

        // Subscribe to specific users
        subscription.subscribeToAll = false;
        const validUserIds = data.userIds.filter(userId => isValidUserAddress(userId));

        validUserIds.forEach(userId => {
            subscription.userIds.add(userId);
            this.watchedUsers.add(userId);
        });

        // Send balances for these users
        const messages = this.createBalanceMessagesForUsers(validUserIds);
        this.room.getConnection(clientId)?.send(JSON.stringify({
            type: 'BALANCE_BATCH',
            balances: messages,
            timestamp: Date.now()
        }));

        // Trigger fetch if new users
        const newUsers = validUserIds.filter(userId =>
            !Array.from(this.balances.keys()).some(key => key.startsWith(`${userId}:`))
        );
        if (newUsers.length > 0) {
            this.fetchAndBroadcastBalances();
        }
    }

    private handleUnsubscribe(data: BalanceSubscription, clientId: string) {
        const subscription = this.subscriptions.get(clientId);
        if (!subscription) return;

        if (!data.userIds || data.userIds.length === 0) {
            subscription.subscribeToAll = false;
            subscription.userIds.clear();
        } else {
            data.userIds.forEach(userId => subscription.userIds.delete(userId));
        }

        this.cleanupWatchedUsers();
    }

    private cleanupWatchedUsers() {
        const activeUsers = new Set<string>();
        this.subscriptions.forEach(subscription => {
            if (subscription.subscribeToAll) {
                this.balances.forEach((_, key) => {
                    activeUsers.add(key.split(':')[0]!);
                });
            } else {
                subscription.userIds.forEach(userId => activeUsers.add(userId));
            }
        });
        this.watchedUsers = activeUsers;
    }

    private createAllBalanceMessages(): BalanceUpdateMessage[] {
        return Array.from(this.balances.values()).map(balance => this.createBalanceMessage(balance));
    }

    private createBalanceMessagesForUsers(userIds: string[]): BalanceUpdateMessage[] {
        const messages: BalanceUpdateMessage[] = [];

        // For each mainnet token, create a message for each user (even if zero balance)
        for (const tokenRecord of this.tokenRecords.values()) {
            if (tokenRecord.tokenType === SUBNET_TOKEN_TYPE) continue; // Skip subnet tokens

            for (const userId of userIds) {
                const key = `${userId}:${tokenRecord.contractId}`;
                const balance = this.balances.get(key);

                if (balance) {
                    messages.push(this.createBalanceMessage(balance));
                } else {
                    // Create zero balance with metadata
                    messages.push(this.createZeroBalanceMessage(userId, tokenRecord));
                }
            }
        }

        return messages;
    }

    private createBalanceMessage(balance: TokenBalance): BalanceUpdateMessage {
        const mainnetRecord = this.getOrCreateFallbackRecord(balance.mainnetContractId);

        const mainnetBalance = {
            balance: balance.mainnetBalance,
            totalSent: balance.mainnetTotalSent,
            totalReceived: balance.mainnetTotalReceived,
            formattedBalance: formatBalance(balance.mainnetBalance.toString(), mainnetRecord.decimals),
            timestamp: balance.lastUpdated,
            source: 'hiro-api'
        };

        const subnetBalanceInfo = balance.subnetBalance !== undefined ? {
            contractId: balance.subnetContractId!,
            balance: balance.subnetBalance,
            totalSent: balance.subnetTotalSent!,
            totalReceived: balance.subnetTotalReceived!,
            formattedBalance: formatBalance(balance.subnetBalance.toString(), mainnetRecord.decimals),
            timestamp: balance.lastUpdated,
            source: 'subnet-contract-call'
        } : undefined;

        return createBalanceUpdateMessage(mainnetRecord, balance.userId, mainnetBalance, subnetBalanceInfo);
    }

    private createZeroBalanceMessage(userId: string, mainnetRecord: EnhancedTokenRecord): BalanceUpdateMessage {
        const mainnetBalance = {
            balance: 0,
            totalSent: '0',
            totalReceived: '0',
            formattedBalance: 0,
            timestamp: Date.now(),
            source: 'default-zero'
        };

        // Look for subnet token
        let subnetBalanceInfo = undefined;
        for (const record of this.tokenRecords.values()) {
            if (record.tokenType === SUBNET_TOKEN_TYPE && record.baseToken === mainnetRecord.contractId) {
                subnetBalanceInfo = {
                    contractId: record.contractId,
                    balance: 0,
                    totalSent: '0',
                    totalReceived: '0',
                    formattedBalance: 0,
                    timestamp: Date.now(),
                    source: 'default-zero'
                };
                break;
            }
        }

        return createBalanceUpdateMessage(mainnetRecord, userId, mainnetBalance, subnetBalanceInfo);
    }

    private async fetchAndBroadcastBalances() {
        if (this.watchedUsers.size === 0) return;

        try {
            const userIds = Array.from(this.watchedUsers);
            const rawBalances = await fetchUserBalances(userIds, this.tokenRecords);
            const now = Date.now();

            console.log(`💰 Fetched ${Object.keys(rawBalances).length} balance entries for ${userIds.length} users`);

            const updatedBalances: TokenBalance[] = [];

            // Process each raw balance
            for (const [, balanceData] of Object.entries(rawBalances)) {
                const { userId, contractId } = balanceData;

                // Find token record with fallback logic
                const tokenRecord = this.findTokenRecord(contractId);
                if (!tokenRecord) {
                    console.warn(`🔍 No token record found for ${contractId} - balance: ${balanceData.balance}`);
                    continue;
                }

                // Validate token record
                if (!this.validateTokenRecord(tokenRecord, contractId)) {
                    continue;
                }

                const isSubnet = tokenRecord.tokenType === SUBNET_TOKEN_TYPE;
                // For mainnet tokens, use the base contract ID (tokenRecord.contractId) as the key
                // This ensures tokens with identifiers get grouped under their base contract
                const mainnetContractId = isSubnet ? tokenRecord.baseToken! : tokenRecord.contractId;

                const key = `${userId}:${mainnetContractId}`;

                let balance = this.balances.get(key);
                if (!balance) {
                    balance = {
                        userId,
                        mainnetContractId,
                        mainnetBalance: 0,
                        mainnetTotalSent: '0',
                        mainnetTotalReceived: '0',
                        lastUpdated: now
                    };
                }

                // Update mainnet or subnet portion
                if (isSubnet) {
                    balance.subnetBalance = balanceData.balance;
                    balance.subnetTotalSent = balanceData.totalSent;
                    balance.subnetTotalReceived = balanceData.totalReceived;
                    balance.subnetContractId = contractId;
                } else {
                    balance.mainnetBalance = balanceData.balance;
                    balance.mainnetTotalSent = balanceData.totalSent;
                    balance.mainnetTotalReceived = balanceData.totalReceived;
                }

                balance.lastUpdated = now;
                this.balances.set(key, balance);
                updatedBalances.push(balance);

                console.log(`✅ Processed ${isSubnet ? 'subnet' : 'mainnet'} balance: ${userId.slice(0, 8)}...${userId.slice(-4)}:${contractId} = ${balanceData.balance}`);
            }

            // Broadcast updates
            if (updatedBalances.length > 0) {
                const messages = updatedBalances.map(balance => this.createBalanceMessage(balance));

                messages.forEach(message => {
                    this.room.broadcast(JSON.stringify(message));
                });

                this.room.broadcast(JSON.stringify({
                    type: 'BALANCE_BATCH',
                    balances: messages,
                    timestamp: now
                }));

                console.log(`📊 Broadcasted ${messages.length} balance updates`);
            }

        } catch (err) {
            console.error('Failed to fetch/broadcast balances:', err);
        }
    }
}

BalancesParty satisfies Party.Worker;