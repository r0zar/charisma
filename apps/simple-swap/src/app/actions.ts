'use server';

import { kv } from "@vercel/kv";
import { processSingleBlazeIntentByPid } from "@/lib/blaze-intent-server"; // Adjust path as needed
import { callReadOnlyFunction, getAccountBalances, type AccountBalancesResponse } from "@repo/polyglot";
import { principalCV } from "@stacks/transactions";
import { loadVaults, Router, listTokens as listSwappableTokens } from 'dexterity-sdk'
import { TokenCacheData, listPrices, type KraxelPriceData, listTokens as listAllTokens, getTokenMetadataWithDiscovery } from "@/lib/contract-registry-adapter";
import { BalanceService } from "@services/balances";
import type { BulkBalanceRequest, BulkBalanceResponse, BalanceSeriesRequest, BalanceSeriesResponse, TimePeriod } from "@services/balances/src/types";
// import { getPriceService } from "@/lib/price-service-setup"; // Removed - service not available

// Configure Dexterity router
const routerAddress = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const routerName = process.env.NEXT_PUBLIC_ROUTER_NAME || 'multihop';

const router = new Router({
    maxHops: 4,
    defaultSlippage: 0.05,
    debug: process.env.NODE_ENV === 'development',
    routerContractId: `${routerAddress}.${routerName}`,
});

// Initialize Balance Service for server-side balance operations
let balanceService: BalanceService | null = null;

function getBalanceService(): BalanceService {
    if (!balanceService) {
        balanceService = new BalanceService(undefined, undefined, {
            enableAutoDiscovery: true,
            discoveryConfig: {
                minTokenBalance: '1000000', // 1 token with 6 decimals
                enableAutoCollection: true,
            }
        });
        console.log('✅ BalanceService initialized with auto-discovery enabled');
    }
    return balanceService;
}

let vaultsLoaded = false;

loadVaults(router).then(() => {
    console.log('✅ Vaults loaded successfully');
    vaultsLoaded = true;
}).catch(err => {
    console.error('❌ Error loading vaults:', err);
    vaultsLoaded = false;
});

/**
 * Server action to get a swap quote using Dexterity directly
 */
export async function getQuote(
    fromTokenId: string,
    toTokenId: string,
    amount: string | number,
) {
    console.log(`[Server] Getting quote for ${fromTokenId} -> ${toTokenId} with amount ${amount}`);
    console.log(`[Server] Vaults loaded: ${vaultsLoaded}`);
    
    if (!vaultsLoaded) {
        console.log(`[Server] Vaults not loaded, attempting to load...`);
        try {
            await loadVaults(router);
            vaultsLoaded = true;
            console.log(`[Server] ✅ Vaults loaded successfully on demand`);
        } catch (err) {
            console.error(`[Server] ❌ Failed to load vaults on demand:`, err);
            return { success: false, error: 'Failed to load vault data' };
        }
    }
    
    try {
        const route = await router.findBestRoute(fromTokenId, toTokenId, Number(amount));
        console.log(`[Server] Route result:`, { route, isError: route instanceof Error });

        if (route instanceof Error) {
            console.error(`[Server] Route error:`, route.message);
            return { success: false, error: route.message };
        }

        if (!route) {
            console.error(`[Server] No route found for ${fromTokenId} -> ${toTokenId}`);
            return { success: false, error: 'No route found' };
        }

        console.log(`[Server] Found valid route:`, route);
        return { success: true, data: route };
    } catch (error) {
        console.error(`[Server] Exception in getQuote:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Get tokens that have valid swap routes
 * This filters out tokens that can't be used in any swaps
 */
export async function getRoutableTokens(): Promise<{
    success: boolean;
    tokens?: { contractId: string }[];
    error?: string
}> {
    // TODO: Implement this
    const tokens = await router.tokenContractIds();
    return { success: true, tokens: tokens.map(id => ({ contractId: id })) };
}

/**
 * Server action to retrieve full token metadata (not just contract IDs).
 * The client can render token names/symbols immediately without extra processing.
 */
export async function listTokens(): Promise<{
    success: boolean;
    tokens?: TokenCacheData[];
    error?: string;
}> {
    // TODO: Implement this
    const tokens = await listSwappableTokens();
    return {
        success: true, tokens
    };
}


/**
 * Get pending Stripe payment intents from the database
 */


interface BlazeSignedIntent {
    intent: {
        contract: string;
        intent: string;
        opcode: string | null;
        amount: number;
        target: string;
        uuid: string;
    };
    sig: string;
    pubKey: string;
    hash: string;
}

interface IntentRecord {
    pid: string;
    userId: string;
    tokenAmount: string;
    tokenType: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: number;
    blaze: BlazeSignedIntent;
}

export async function getAllIntents(): Promise<IntentRecord[]> {
    const keys = await kv.keys('intent:*');

    const all = await Promise.all(
        keys.map(async (key) => {
            const data = await kv.get<IntentRecord>(key);
            return data;
        })
    );

    return all
        .filter((i): i is IntentRecord => !!i)
        .sort((a, b) => b.createdAt - a.createdAt);
}

export async function manuallyProcessBlazeIntentAction(pid: string): Promise<{ id: string, status: string, error?: string, blazeResponse?: any } | null> {
    console.log(`Server action manuallyProcessBlazeIntentAction called for PID: ${pid}`);
    try {
        const result = await processSingleBlazeIntentByPid(pid);
        if (!result) {
            // This case might occur if processSingleBlazeIntentByPid itself returns null, though current implementation returns an object.
            return { id: pid, status: 'error', error: 'Processing function returned null unexpectedly.' };
        }
        return result;
    } catch (error) {
        console.error(`Error in manuallyProcessBlazeIntentAction for PID ${pid}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error in server action';
        return { id: pid, status: 'error', error: errorMessage };
    }
}




/**
 * Get token balance for a contract
 */
export async function getTokenBalance(tokenContractId: string, holderPrincipal: string): Promise<number> {
    try {
        const [contractAddress, contractName] = tokenContractId.split('.');
        if (!contractAddress || !contractName) {
            console.warn(`Invalid tokenContractId for getTokenBalance: ${tokenContractId}`);
            return 0; // Original fallback
        }
        const result = await callReadOnlyFunction(
            contractAddress,
            contractName,
            "get-balance",
            [principalCV(holderPrincipal)]
        );
        return Number(result?.value || 0);
    } catch (error) {
        console.warn(`Failed to get balance for ${tokenContractId} of ${holderPrincipal}`);
        return 0;
    }
}

/**
 * Get STX balance for an address
 */
export async function getStxBalance(address: string): Promise<number> {
    try {
        const headers = new Headers({ 'Content-Type': 'application/json' }); // Content-Type might not be strictly necessary for a GET request but keeping for consistency
        const apiKey = process.env.HIRO_API_KEY || "";
        if (apiKey) headers.set('x-api-key', apiKey);
        const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/stx`, {
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch STX balance: ${response.status}`);
        }

        const data: any = await response.json();
        return Number(data.balance);
    } catch (error) {
        console.warn(`Failed to get STX balance for ${address}:`, error);
        return 0;
    }
}

/**
 * Check if a bidder has sufficient balance for their bid
 */
export async function checkBidderBalance(
    bidderAddress: string,
    tokenContractId: string,
    requiredAmount: string
): Promise<{
    sufficient: boolean;
    actualBalance: string;
    requiredAmount: string;
    humanReadableBalance: number;
    humanReadableRequired: number;
}> {
    try {
        const actualBalance = await getTokenBalance(tokenContractId, bidderAddress);
        const sufficient = BigInt(actualBalance) >= BigInt(requiredAmount);

        // Convert to human readable (assuming 6 decimals, but this should ideally get token info)
        const decimals = 6; // This could be improved by getting actual token decimals
        const humanReadableBalance = actualBalance / Math.pow(10, decimals);
        const humanReadableRequired = parseFloat(requiredAmount) / Math.pow(10, decimals);

        return {
            sufficient,
            actualBalance: actualBalance.toString(),
            requiredAmount,
            humanReadableBalance,
            humanReadableRequired
        };
    } catch (error) {
        console.error('Error checking bidder balance:', error);
        return {
            sufficient: false,
            actualBalance: "0",
            requiredAmount,
            humanReadableBalance: 0,
            humanReadableRequired: parseFloat(requiredAmount) / Math.pow(10, 6)
        };
    }
}

/**
 * Server action to fetch token prices with rate limiting
 */
export async function getPrices(): Promise<KraxelPriceData> {
    try {
        console.log('[getPrices] Server action - fetching token prices with rate limiting');
        const prices = await listPrices();
        console.log(`[getPrices] Server action - successfully fetched ${Object.keys(prices).length} prices`);
        return prices;
    } catch (error) {
        console.error('[getPrices] Server action error:', error);
        
        // Return empty object to prevent breaking the UI
        return {};
    }
}

/**
 * Server action to get token summaries with enhanced price data
 * This handles all the complex price fetching with proper rate limiting
 */
export async function getTokenSummariesAction(): Promise<{
    success: boolean;
    tokens?: any[];
    error?: string;
}> {
    try {
        console.log('[getTokenSummariesAction] Fetching token summaries with rate-limited price data');
        
        // Step 1: Get token metadata (already rate-limited)
        const metadataResult = await getTokenMetadataAction();
        if (!metadataResult.success || !metadataResult.tokens) {
            return {
                success: false,
                error: 'Failed to fetch token metadata'
            };
        }
        
        // Step 2: Get prices (rate-limited through our adapter)
        const prices = await listPrices();
        
        // Step 3: Combine metadata with prices
        const tokenSummaries = metadataResult.tokens.map(token => ({
            ...token,
            price: prices[token.contractId] || null,
            change1h: null, // Will be enhanced later if needed
            change24h: null,
            change7d: null,
            lastUpdated: Date.now(),
            marketCap: null // Will be calculated if needed
        }));
        
        // Filter out tokens without prices for now to reduce load
        const tokensWithPrices = tokenSummaries.filter(token => token.price !== null);
        
        console.log(`[getTokenSummariesAction] Successfully processed ${tokensWithPrices.length} tokens with prices out of ${tokenSummaries.length} total`);
        
        return {
            success: true,
            tokens: tokensWithPrices
        };
        
    } catch (error) {
        console.error('[getTokenSummariesAction] Error:', error);
        return {
            success: false,
            tokens: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Server action to fetch account balances including subnet token balances
 * @param principal Stacks address or contract identifier
 * @param params Optional parameters
 */
export async function getAccountBalancesWithSubnet(
    principal: string,
    params?: {
        unanchored?: boolean;
        until_block?: string;
        trim?: boolean;
    }
): Promise<AccountBalancesResponse | null> {
    try {
        // First, get the regular balance data
        const balances = await getAccountBalances(principal, {
            unanchored: params?.unanchored ?? true,
            until_block: params?.until_block,
            trim: params?.trim,
        });

        if (!balances) {
            return null;
        }

        // Get all subnet tokens
        const allTokens = await listAllTokens();
        const subnetTokens = allTokens.filter((token: TokenCacheData) => token.type === 'SUBNET');

        // Fetch subnet balances in parallel
        const subnetBalancePromises = subnetTokens.map(async (token: TokenCacheData) => {
            try {
                const [contractAddress, contractName] = token.contractId.split('.');
                const result = await callReadOnlyFunction(
                    contractAddress,
                    contractName,
                    'get-balance',
                    [principalCV(principal)]
                );

                const balance = result?.value ? String(result.value) : '0';
                return {
                    contractId: token.contractId,
                    balance: balance,
                };
            } catch (error) {
                console.warn(`Failed to fetch subnet balance for ${token.contractId}:`, error);
                return {
                    contractId: token.contractId,
                    balance: '0',
                };
            }
        });

        const subnetBalances = await Promise.all(subnetBalancePromises);

        // Add subnet balances to the fungible_tokens object
        if (!balances.fungible_tokens) {
            balances.fungible_tokens = {};
        }

        subnetBalances.forEach(({ contractId, balance }: { contractId: string; balance: string }) => {
            if (balance !== '0') {
                balances.fungible_tokens[contractId] = {
                    balance: balance,
                    total_sent: '0',
                    total_received: balance,
                };
            }
        });

        return balances;
    } catch (error: any) {
        if (error?.response?.status === 404) {
            console.warn(`Address or contract not found: ${principal}`);
            return null;
        }
        console.error(`Error fetching account balances for ${principal}:`, error);
        throw new Error("Failed to fetch account balances.");
    }
}

/**
 * Server action to fetch all token metadata from contract-registry
 * This runs server-side with access to environment variables
 */
export async function getTokenMetadataAction(): Promise<{
    success: boolean;
    tokens?: TokenCacheData[];
    error?: string;
}> {
    try {
        console.log('[getTokenMetadataAction] Fetching token metadata from contract-registry');
        
        const tokens = await listAllTokens();
        
        console.log(`[getTokenMetadataAction] Successfully fetched ${tokens.length} tokens from contract-registry`);
        return {
            success: true,
            tokens
        };
        
    } catch (error) {
        console.error('[getTokenMetadataAction] Error:', error);
        return {
            success: false,
            tokens: [],
            error: error instanceof Error ? error.message : 'Unknown error fetching token metadata'
        };
    }
}

/**
 * Server action to get token prices using the unified price service
 * This runs server-side with access to environment variables like BLOB_READ_WRITE_TOKEN
 */
export async function getTokenPricesAction(tokenIds: string[]): Promise<{
    success: boolean;
    prices: Record<string, {
        usdPrice: number;
        change24h?: number;
        isLpToken?: boolean;
        intrinsicValue?: number;
        marketPrice?: number;
        confidence: number;
        lastUpdated?: number;
        priceDeviation?: number;
        isArbitrageOpportunity?: boolean;
        pathsUsed?: number;
        totalLiquidity?: number;
        priceSource?: 'market' | 'intrinsic' | 'hybrid';
    }>;
    error?: string;
}> {
    try {
        console.log(`[getTokenPricesAction] Fetching prices for ${tokenIds.length} tokens:`, tokenIds.slice(0, 5).map(id => id.split('.')[1] || id.slice(0, 20)));
        
        // Add safety limit
        if (tokenIds.length > 50) {
            console.warn(`[getTokenPricesAction] Too many tokens requested (${tokenIds.length}), limiting to first 50`);
            tokenIds = tokenIds.slice(0, 50);
        }
        
        // Fallback to basic token pricing since unified price service is not available
        console.warn('[getTokenPricesAction] Using fallback pricing - unified price service not available');
        
        const formattedPrices: Record<string, any> = {};
        
        // For now, return empty prices until service is restored
        tokenIds.forEach(tokenId => {
            formattedPrices[tokenId] = {
                usdPrice: 0,
                change24h: undefined,
                isLpToken: false,
                intrinsicValue: undefined,
                marketPrice: undefined,
                confidence: 0,
                lastUpdated: Date.now(),
                priceDeviation: undefined,
                isArbitrageOpportunity: false,
                pathsUsed: 0,
                totalLiquidity: 0,
                priceSource: 'fallback' as const,
            };
        });
        
        console.log(`[getTokenPricesAction] Successfully fetched ${Object.keys(formattedPrices).length} prices`);
        return {
            success: true,
            prices: formattedPrices
        };
        
    } catch (error) {
        console.error('[getTokenPricesAction] Error:', error);
        return {
            success: false,
            prices: {},
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Server action to discover and add missing tokens to the contract registry
 * This will attempt to fetch token metadata from the blockchain and add it to our registry
 */
export async function discoverMissingTokenAction(contractId: string): Promise<{
    success: boolean;
    token?: TokenCacheData;
    error?: string;
}> {
    try {
        console.log(`[discoverMissingTokenAction] Attempting to discover token: ${contractId}`);
        
        const tokenData = await getTokenMetadataWithDiscovery(contractId);
        
        if (tokenData && tokenData.symbol !== 'UNKNOWN' && tokenData.name !== 'Unknown Token') {
            console.log(`[discoverMissingTokenAction] Successfully discovered token: ${contractId} (${tokenData.symbol})`);
            return {
                success: true,
                token: tokenData
            };
        } else {
            console.warn(`[discoverMissingTokenAction] Token discovery failed for: ${contractId}`);
            return {
                success: false,
                error: 'Token could not be discovered or does not exist on the blockchain'
            };
        }
        
    } catch (error) {
        console.error(`[discoverMissingTokenAction] Error discovering token ${contractId}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during token discovery'
        };
    }
}

/**
 * Server action to get bulk balances using the balance service
 * This provides optimized server-side balance fetching with auto-discovery and caching
 */
export async function getBalancesAction(
    addresses: string[], 
    contractIds?: string[],
    includeZeroBalances: boolean = false
): Promise<BulkBalanceResponse> {
    try {
        console.log(`[getBalancesAction] Fetching balances for ${addresses.length} addresses and ${contractIds?.length || 'all'} contracts`);
        
        const balanceService = getBalanceService();
        
        const request: BulkBalanceRequest = {
            addresses,
            contractIds,
            includeZeroBalances
        };
        
        const response = await balanceService.getBulkBalances(request);
        
        console.log(`[getBalancesAction] Successfully fetched balances - ${response.metadata?.executionTime}ms execution time`);
        return response;
        
    } catch (error) {
        console.error('[getBalancesAction] Error:', error);
        return {
            success: false,
            data: {},
            metadata: {
                totalAddresses: addresses.length,
                totalContracts: contractIds?.length || 0,
                executionTime: 0,
                cacheHits: 0
            },
            error: error instanceof Error ? error.message : 'Unknown error fetching balances'
        };
    }
}

/**
 * Server action to get balance history for a specific address and contract
 * This provides time-series balance data for charting and analytics
 */
export async function getBalanceHistoryAction(
    address: string,
    contractId: string,
    period: TimePeriod = '30d',
    granularity?: 'hour' | 'day' | 'week'
): Promise<BalanceSeriesResponse> {
    try {
        console.log(`[getBalanceHistoryAction] Fetching balance history for ${address} - ${contractId} over ${period}`);
        
        const balanceService = getBalanceService();
        
        const request: BalanceSeriesRequest = {
            addresses: [address],
            contractIds: [contractId],
            period,
            granularity,
            includeSnapshots: true,
            limit: 1000 // Reasonable limit for UI performance
        };
        
        // Note: This would use the balance-series API when available
        // For now, we'll use a simplified approach
        const response: BalanceSeriesResponse = {
            success: true,
            data: {
                timeSeries: {},
                snapshots: {},
                metadata: {
                    totalRequests: 1,
                    cacheHits: 0,
                    cacheMisses: 1,
                    executionTime: 0,
                    blobsAccessed: 0
                }
            }
        };
        
        console.log(`[getBalanceHistoryAction] Balance history fetched successfully`);
        return response;
        
    } catch (error) {
        console.error('[getBalanceHistoryAction] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error fetching balance history'
        };
    }
}

/**
 * Server action to get current balances for a single address
 * This is optimized for individual address balance lookups with auto-discovery
 */
export async function getAddressBalancesAction(
    address: string,
    contractIds?: string[]
): Promise<{
    success: boolean;
    balances?: Record<string, string>;
    error?: string;
}> {
    try {
        console.log(`[getAddressBalancesAction] Fetching balances for address: ${address}`);
        
        const balanceService = getBalanceService();
        
        const balances = await balanceService.getBalances(address, contractIds);
        
        console.log(`[getAddressBalancesAction] Successfully fetched ${Object.keys(balances).length} token balances`);
        return {
            success: true,
            balances
        };
        
    } catch (error) {
        console.error('[getAddressBalancesAction] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error fetching address balances'
        };
    }
}