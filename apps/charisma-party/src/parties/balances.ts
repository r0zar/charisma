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
import type {
    WebSocketTokenBalance,
    BalanceSubscription,
    ClientSubscription,
    UserBalanceInfo
} from "../types/balance-types";
import {
    TOKEN_TYPES,
    isSubnetToken,
    hasValidBaseMapping
} from "../types/balance-types";

// Constants
const BALANCE_UPDATE_INTERVAL = 300_000; // 5 minutes
const INITIAL_FETCH_DELAY = 3_000; // 3 seconds
const DEFAULT_DECIMALS = 6;
const INITIALIZATION_TIMEOUT = 10_000; // 10 seconds
const HIBERNATION_DETECTION_THRESHOLD = 5_000; // 5 seconds

export default class BalancesParty implements Party.Server {
    private subscriptions = new Map<string, ClientSubscription>();
    private tokenRecords = new Map<string, EnhancedTokenRecord>();
    private watchedUsers = new Set<string>();

    // SINGLE source of truth: `${userId}:${mainnetContractId}` -> WebSocketTokenBalance
    private balances = new Map<string, WebSocketTokenBalance>();

    private localInterval: NodeJS.Timeout | null = null;
    private isLocalDev = false;
    
    // Initialization state management
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    private initializationStartTime = 0;
    private lastActiveTime = Date.now();

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
        if (isSubnetToken(tokenRecord)) {
            if (!hasValidBaseMapping(tokenRecord, this.tokenRecords)) {
                console.warn(`⚠️ Subnet token ${contractId} has invalid base mapping: ${tokenRecord.base || 'undefined'}`);
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
            type: TOKEN_TYPES.SIP10,
            identifier: '',
            token_uri: null,
            lastUpdated: Date.now(),
            tokenAContract: null,
            tokenBContract: null,
            lpRebatePercent: null,
            externalPoolId: null,
            engineContractId: null,
            base: null,
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
        this.initializeServer();

        if (this.isLocalDev) {
            this.startLocalInterval();
        } else {
            this.room.storage.setAlarm(Date.now() + BALANCE_UPDATE_INTERVAL);
        }
    }

    private detectLocalDev(): boolean {
        try {
            // Check for test environment first
            if (process.env.NODE_ENV === 'test' || process.env.PARTYKIT_ENV === 'test') {
                return true;
            }
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
    
    private async initializeServer() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        this.initializationStartTime = Date.now();
        console.log('🚀 Server initialization starting...');
        
        this.initializationPromise = this.performInitialization();
        
        try {
            await this.initializationPromise;
            this.isInitialized = true;
            const initTime = Date.now() - this.initializationStartTime;
            console.log(`✅ Server initialization completed in ${initTime}ms`);
        } catch (error) {
            console.error('❌ Server initialization failed:', error);
            // Reset for retry
            this.initializationPromise = null;
            this.isInitialized = false;
        }
    }
    
    private async performInitialization(): Promise<void> {
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Initialization timeout')), INITIALIZATION_TIMEOUT);
        });
        
        const initialization = async () => {
            // Check if we're waking up from hibernation
            const timeSinceLastActive = Date.now() - this.lastActiveTime;
            if (timeSinceLastActive > HIBERNATION_DETECTION_THRESHOLD) {
                console.log(`🌙 Detected hibernation wake-up (${timeSinceLastActive}ms since last active)`);
                // Force reload metadata after hibernation
                this.tokenRecords.clear();
            }
            
            // Load token metadata
            await this.loadTokenMetadata();
            
            // Update last active time
            this.lastActiveTime = Date.now();
        };
        
        await Promise.race([initialization(), timeout]);
    }
    
    private async waitForInitialization(): Promise<void> {
        if (this.isInitialized) {
            return;
        }
        
        if (!this.initializationPromise) {
            await this.initializeServer();
        } else {
            await this.initializationPromise;
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

        // Wait for initialization before sending data
        this.waitForInitialization().then(() => {
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
                initialized: this.isInitialized,
                timestamp: Date.now()
            }));
        }).catch(error => {
            console.error(`❌ Failed to send initial data to client ${clientId}:`, error);
            conn.send(JSON.stringify({
                type: 'ERROR',
                message: 'Server initialization failed',
                timestamp: Date.now()
            }));
        });
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
                case 'REFRESH':
                    this.handleRefresh(data, clientId);
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

    async onRequest(request: Party.Request) {
        if (request.method === 'GET') {
            try {
                // Wait for initialization before processing request
                await this.waitForInitialization();
                
                const url = new URL(request.url);
                const userIds = url.searchParams.get('users')?.split(',') || [];

                const messages = userIds.length === 0
                    ? this.createAllBalanceMessages()
                    : this.createBalanceMessagesForUsers(userIds);

                return new Response(JSON.stringify({
                    balances: messages,
                    party: 'balances',
                    serverTime: Date.now(),
                    initialized: this.isInitialized
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('❌ Request failed due to initialization error:', error);
                return new Response(JSON.stringify({
                    error: 'Server initialization failed',
                    party: 'balances',
                    serverTime: Date.now(),
                    initialized: false
                }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
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

    private handleRefresh(data: any, clientId: string) {
        // Force refresh balances for specific users
        if (data.userIds && Array.isArray(data.userIds)) {
            const validUserIds = data.userIds.filter((userId: string) => isValidUserAddress(userId));
            if (validUserIds.length > 0) {
                // Fetch fresh balances for these users and broadcast
                this.fetchAndBroadcastBalancesForUsers(validUserIds);
            }
        } else {
            // No userIds specified, refresh all
            this.fetchAndBroadcastBalances();
        }
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
        const messages: BalanceUpdateMessage[] = [];
        for (const balance of this.balances.values()) {
            messages.push(...this.createBalanceMessage(balance));
        }
        return messages;
    }

    private createBalanceMessagesForUsers(userIds: string[]): BalanceUpdateMessage[] {
        const messages: BalanceUpdateMessage[] = [];

        // For each mainnet token, create a message for each user (even if zero balance)
        for (const tokenRecord of this.tokenRecords.values()) {
            if (isSubnetToken(tokenRecord)) continue; // Skip subnet tokens

            for (const userId of userIds) {
                const key = `${userId}:${tokenRecord.contractId}`;
                const balance = this.balances.get(key);

                if (balance) {
                    messages.push(...this.createBalanceMessage(balance));
                } else {
                    // Create zero balance with metadata
                    messages.push(this.createZeroBalanceMessage(userId, tokenRecord));
                }
            }
        }

        return messages;
    }

    private createBalanceMessage(balance: WebSocketTokenBalance): BalanceUpdateMessage[] {
        const messages: BalanceUpdateMessage[] = [];
        const mainnetRecord = this.getOrCreateFallbackRecord(balance.mainnetContractId);

        // Create mainnet balance message
        const mainnetBalance: UserBalanceInfo = {
            balance: balance.mainnetBalance,
            totalSent: balance.mainnetTotalSent,
            totalReceived: balance.mainnetTotalReceived,
            formattedBalance: formatBalance(balance.mainnetBalance.toString(), mainnetRecord.decimals),
            timestamp: balance.lastUpdated,
            source: 'hiro-api'
        };

        messages.push(createBalanceUpdateMessage(mainnetRecord, balance.userId, mainnetBalance));

        // Create separate subnet balance message if exists
        if (balance.subnetBalance !== undefined && balance.subnetContractId) {
            const subnetRecord = this.findTokenRecord(balance.subnetContractId);
            if (subnetRecord) {
                const subnetBalance: UserBalanceInfo = {
                    balance: balance.subnetBalance,
                    totalSent: balance.subnetTotalSent!,
                    totalReceived: balance.subnetTotalReceived!,
                    formattedBalance: formatBalance(balance.subnetBalance.toString(), subnetRecord.decimals),
                    timestamp: balance.lastUpdated,
                    source: 'subnet-contract-call'
                };

                messages.push(createBalanceUpdateMessage(subnetRecord, balance.userId, subnetBalance));
            }
        }

        return messages;
    }

    private createZeroBalanceMessage(userId: string, mainnetRecord: EnhancedTokenRecord): BalanceUpdateMessage {
        const mainnetBalance: UserBalanceInfo = {
            balance: 0,
            totalSent: '0',
            totalReceived: '0',
            formattedBalance: 0,
            timestamp: Date.now(),
            source: 'default-zero'
        };

        // Only create mainnet zero balance - subnet will be separate if it exists
        return createBalanceUpdateMessage(mainnetRecord, userId, mainnetBalance);
    }

    // REMOVED: createAllBalanceUpdatesMap - no longer needed with separate token messages

    private async fetchAndBroadcastBalancesForUsers(userIds: string[]) {
        if (userIds.length === 0) return;

        try {
            const validUserIds = userIds.filter(userId => isValidUserAddress(userId));
            if (validUserIds.length === 0) return;

            const rawBalances = await fetchUserBalances(validUserIds, this.tokenRecords);
            const now = Date.now();

            console.log(`💰 Fetched ${Object.keys(rawBalances).length} balance entries for ${validUserIds.length} specific users`);

            const updatedBalances: WebSocketTokenBalance[] = [];

            // Process each raw balance (same logic as fetchAndBroadcastBalances)
            for (const [, balanceData] of Object.entries(rawBalances)) {
                const { userId, contractId } = balanceData;

                const tokenRecord = this.findTokenRecord(contractId);
                if (!tokenRecord) {
                    console.warn(`🔍 No token record found for ${contractId} - balance: ${balanceData.balance}`);
                    continue;
                }

                if (!this.validateTokenRecord(tokenRecord, contractId)) {
                    continue;
                }

                const isSubnet = isSubnetToken(tokenRecord);
                const mainnetContractId = isSubnet ? tokenRecord.base! : tokenRecord.contractId;

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
                const allMessages: BalanceUpdateMessage[] = [];
                for (const balance of updatedBalances) {
                    allMessages.push(...this.createBalanceMessage(balance));
                }

                allMessages.forEach(message => {
                    this.room.broadcast(JSON.stringify(message));
                });

                this.room.broadcast(JSON.stringify({
                    type: 'BALANCE_BATCH',
                    balances: allMessages,
                    timestamp: now
                }));

                console.log(`📊 Broadcasted ${allMessages.length} balance updates for ${validUserIds.length} specific users`);
            }

        } catch (err) {
            console.error('Failed to fetch/broadcast balances for specific users:', err);
        }
    }

    private async fetchAndBroadcastBalances() {
        if (this.watchedUsers.size === 0) return;

        try {
            const userIds = Array.from(this.watchedUsers);
            const rawBalances = await fetchUserBalances(userIds, this.tokenRecords);
            const now = Date.now();

            console.log(`💰 Fetched ${Object.keys(rawBalances).length} balance entries for ${userIds.length} users`);

            const updatedBalances: WebSocketTokenBalance[] = [];

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

                const isSubnet = isSubnetToken(tokenRecord);
                // For mainnet tokens, use the base contract ID (tokenRecord.contractId) as the key
                // This ensures tokens with identifiers get grouped under their base contract
                const mainnetContractId = isSubnet ? tokenRecord.base! : tokenRecord.contractId;

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
                const allMessages: BalanceUpdateMessage[] = [];
                for (const balance of updatedBalances) {
                    allMessages.push(...this.createBalanceMessage(balance));
                }

                allMessages.forEach(message => {
                    this.room.broadcast(JSON.stringify(message));
                });

                this.room.broadcast(JSON.stringify({
                    type: 'BALANCE_BATCH',
                    balances: allMessages,
                    timestamp: now
                }));

                console.log(`📊 Broadcasted ${allMessages.length} balance updates (${updatedBalances.length} merged balances)`);
            }

        } catch (err) {
            console.error('Failed to fetch/broadcast balances:', err);
        }
    }
}

BalancesParty satisfies Party.Worker;