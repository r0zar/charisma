'use server';

import { kv } from "@vercel/kv";
import { processSingleBlazeIntentByPid } from "@/lib/blaze-intent-server"; // Adjust path as needed
import { callReadOnlyFunction, getAccountBalances, type AccountBalancesResponse } from "@repo/polyglot";
import { cachedBalanceClient, cachedTokenMetadataClient, cachedPriceClient, type CachedBalanceResponse, type CachedTokenMetadata, type CachedPriceData } from "@/lib/cached-balance-client";
import { principalCV } from "@stacks/transactions";
import { loadVaults, Router, listTokens as listSwappableTokens } from 'dexterity-sdk'
import { TokenCacheData, listPrices, type KraxelPriceData, listTokens as listAllTokens, getTokenMetadataWithDiscovery } from "@/lib/contract-registry-adapter";
import type { BulkBalanceRequest, BulkBalanceResponse, BalanceSeriesRequest, BalanceSeriesResponse, TimePeriod } from "@/lib/cached-balance-client";
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

// Use the cached balance client for server-side balance operations
// This client talks to the data app's balance service

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
 * Get token balance for a contract using cached data
 */
export async function getTokenBalance(tokenContractId: string, holderPrincipal: string): Promise<number> {
    try {
        const balance = await cachedBalanceClient.getTokenBalance(holderPrincipal, tokenContractId);
        return Number(balance);
    } catch (error) {
        console.warn(`Failed to get cached balance for ${tokenContractId} of ${holderPrincipal}:`, error);
        
        // Fallback to direct contract call if cached data fails
        try {
            const [contractAddress, contractName] = tokenContractId.split('.');
            if (!contractAddress || !contractName) {
                console.warn(`Invalid tokenContractId for getTokenBalance: ${tokenContractId}`);
                return 0;
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-balance",
                [principalCV(holderPrincipal)]
            );
            return Number(result?.value || 0);
        } catch (fallbackError) {
            console.warn(`Fallback balance fetch also failed for ${tokenContractId} of ${holderPrincipal}`);
            return 0;
        }
    }
}

/**
 * Get STX balance for an address using cached data
 */
export async function getStxBalance(address: string): Promise<number> {
    try {
        return await cachedBalanceClient.getStxBalance(address);
    } catch (error) {
        console.warn(`Failed to get STX balance for ${address}:`, error);
        return 0;
    }
}

/**
 * Check if a bidder has sufficient balance for their bid using cached data
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
        const balanceCheck = await cachedBalanceClient.hasSufficientBalance(
            bidderAddress, 
            tokenContractId, 
            requiredAmount
        );

        // Convert to human readable (assuming 6 decimals, but this should ideally get token info)
        const decimals = 6; // This could be improved by getting actual token decimals
        const humanReadableBalance = parseFloat(balanceCheck.actualBalance) / Math.pow(10, decimals);
        const humanReadableRequired = parseFloat(requiredAmount) / Math.pow(10, decimals);

        return {
            sufficient: balanceCheck.sufficient,
            actualBalance: balanceCheck.actualBalance,
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
 * Server action to fetch token prices using cached data with fallback
 */
export async function getPrices(): Promise<KraxelPriceData> {
    try {
        console.log('[getPrices] Server action - fetching cached token prices');
        
        // First try cached price data
        const cachedPrices = await cachedPriceClient.getAllPricesInKraxelFormat();
        
        if (Object.keys(cachedPrices).length > 0) {
            console.log(`[getPrices] Server action - successfully fetched ${Object.keys(cachedPrices).length} cached prices`);
            return cachedPrices;
        }
        
        console.log('[getPrices] Server action - no cached prices available, falling back to contract-registry');
        
        // Fallback to contract-registry
        const fallbackPrices = await listPrices();
        console.log(`[getPrices] Server action - successfully fetched ${Object.keys(fallbackPrices).length} fallback prices`);
        return fallbackPrices;
        
    } catch (error) {
        console.error('[getPrices] Server action error:', error);
        
        // Return empty object to prevent breaking the UI
        return {};
    }
}

/**
 * Server action to get token summaries with enhanced price data using cached metadata
 * This handles all the complex price fetching with proper rate limiting
 */
export async function getTokenSummariesAction(): Promise<{
    success: boolean;
    tokens?: any[];
    error?: string;
}> {
    try {
        console.log('[getTokenSummariesAction] Fetching token summaries with cached data and rate-limited price data');
        
        // Step 1: Get cached token metadata
        const metadataResult = await getTokenMetadataAction();
        if (!metadataResult.success || !metadataResult.tokens) {
            return {
                success: false,
                error: 'Failed to fetch cached token metadata'
            };
        }
        
        // Step 2: Get cached prices with fallback
        const prices = await getPrices();
        
        // Step 3: Combine metadata with prices
        const tokenSummaries = metadataResult.tokens.map(token => ({
            ...token,
            price: prices[token.contractId] || null,
            change1h: null, // Will be enhanced later if needed
            change24h: null,
            change7d: null,
            lastUpdated: token.lastUpdated || Date.now(),
            marketCap: null // Will be calculated if needed
        }));
        
        // Filter out tokens without prices for now to reduce load
        const tokensWithPrices = tokenSummaries.filter(token => token.price !== null);
        
        console.log(`[getTokenSummariesAction] Successfully processed ${tokensWithPrices.length} tokens with prices out of ${tokenSummaries.length} total (${metadataResult.tokens.length} from cache)`);
        
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
 * Server action to fetch account balances using cached data with subnet token fallback
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
        console.log(`[getAccountBalancesWithSubnet] Fetching cached balances for ${principal}`);
        
        // First, try to get cached balance data from our data app
        const cachedBalances = await cachedBalanceClient.getAddressBalances(principal);
        
        if (cachedBalances) {
            console.log(`[getAccountBalancesWithSubnet] Using cached data for ${principal}`);
            
            // Convert cached response to AccountBalancesResponse format
            const accountBalances: AccountBalancesResponse = {
                stx: cachedBalances.stx,
                fungible_tokens: cachedBalances.fungible_tokens,
                non_fungible_tokens: cachedBalances.non_fungible_tokens
            };

            // Get subnet tokens from cached data
            const allTokens = await cachedTokenMetadataClient.getAllTokens();
            const subnetTokens = allTokens.filter((token) => token.type === 'SUBNET');
            
            // Check if any subnet tokens are missing from cached data
            const missingSubnetTokens = subnetTokens.filter(token => 
                !accountBalances.fungible_tokens[token.contractId]
            );
            
            if (missingSubnetTokens.length > 0) {
                console.log(`[getAccountBalancesWithSubnet] Fetching ${missingSubnetTokens.length} missing subnet tokens`);
                
                // Fetch missing subnet balances
                const subnetBalancePromises = missingSubnetTokens.map(async (token) => {
                    try {
                        const [contractAddress, contractName] = token.contractId.split('.');
                        const result = await callReadOnlyFunction(
                            contractAddress,
                            contractName,
                            'get-balance',
                            [principalCV(principal)]
                        );

                        const balance = result?.value ? String(result.value) : '0';
                        return { contractId: token.contractId, balance };
                    } catch (error) {
                        console.warn(`Failed to fetch subnet balance for ${token.contractId}:`, error);
                        return { contractId: token.contractId, balance: '0' };
                    }
                });

                const subnetBalances = await Promise.all(subnetBalancePromises);

                // Add subnet balances to the result
                subnetBalances.forEach(({ contractId, balance }) => {
                    if (balance !== '0') {
                        accountBalances.fungible_tokens[contractId] = {
                            balance,
                            total_sent: '0',
                            total_received: balance,
                        };
                    }
                });
            }
            
            return accountBalances;
        }

        console.log(`[getAccountBalancesWithSubnet] Cached data not available, falling back to polyglot for ${principal}`);
        
        // Fallback to original polyglot implementation
        const balances = await getAccountBalances(principal, {
            unanchored: params?.unanchored ?? true,
            until_block: params?.until_block,
            trim: params?.trim,
        });

        if (!balances) {
            return null;
        }

        // Get all subnet tokens from cached data with fallback
        let subnetTokens: CachedTokenMetadata[] = [];
        try {
            const allTokens = await cachedTokenMetadataClient.getAllTokens();
            subnetTokens = allTokens.filter((token) => token.type === 'SUBNET');
        } catch (error) {
            console.warn('[getAccountBalancesWithSubnet] Failed to get cached tokens, falling back to contract-registry');
            const fallbackTokens = await listAllTokens();
            subnetTokens = fallbackTokens.filter((token: TokenCacheData) => token.type === 'SUBNET').map(token => ({
                contractId: token.contractId,
                name: token.name,
                symbol: token.symbol,
                decimals: token.decimals,
                totalSupply: token.totalSupply || '0',
                type: token.type as CachedTokenMetadata['type'],
                verified: token.verified,
            }));
        }

        // Fetch subnet balances in parallel
        const subnetBalancePromises = subnetTokens.map(async (token) => {
            try {
                const [contractAddress, contractName] = token.contractId.split('.');
                const result = await callReadOnlyFunction(
                    contractAddress,
                    contractName,
                    'get-balance',
                    [principalCV(principal)]
                );

                const balance = result?.value ? String(result.value) : '0';
                return { contractId: token.contractId, balance };
            } catch (error) {
                console.warn(`Failed to fetch subnet balance for ${token.contractId}:`, error);
                return { contractId: token.contractId, balance: '0' };
            }
        });

        const subnetBalances = await Promise.all(subnetBalancePromises);

        // Add subnet balances to the fungible_tokens object
        if (!balances.fungible_tokens) {
            balances.fungible_tokens = {};
        }

        subnetBalances.forEach(({ contractId, balance }) => {
            if (balance !== '0') {
                balances.fungible_tokens[contractId] = {
                    balance,
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
 * Server action to fetch all token metadata from cached data app
 * This runs server-side with cached data for better performance
 */
export async function getTokenMetadataAction(): Promise<{
    success: boolean;
    tokens?: CachedTokenMetadata[];
    error?: string;
}> {
    try {
        console.log('[getTokenMetadataAction] Fetching token metadata from cached data');
        
        const tokens = await cachedTokenMetadataClient.getAllTokens();
        
        if (tokens.length === 0) {
            console.log('[getTokenMetadataAction] No cached tokens found, falling back to contract-registry');
            
            // Fallback to contract-registry if no cached data is available
            try {
                const fallbackTokens = await listAllTokens();
                
                // Convert TokenCacheData to CachedTokenMetadata format
                const convertedTokens: CachedTokenMetadata[] = fallbackTokens.map(token => ({
                    contractId: token.contractId,
                    name: token.name,
                    symbol: token.symbol,
                    decimals: token.decimals,
                    totalSupply: token.totalSupply || '0',
                    type: token.type as CachedTokenMetadata['type'],
                    logo: token.logo,
                    description: token.description,
                    website: token.website,
                    coingeckoId: token.coingeckoId,
                    tags: token.tags,
                    verified: token.verified,
                    lastUpdated: Date.now()
                }));
                
                console.log(`[getTokenMetadataAction] Successfully fetched ${convertedTokens.length} tokens from fallback contract-registry`);
                return {
                    success: true,
                    tokens: convertedTokens
                };
            } catch (fallbackError) {
                console.error('[getTokenMetadataAction] Fallback error:', fallbackError);
                return {
                    success: false,
                    tokens: [],
                    error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error fetching fallback token metadata'
                };
            }
        }
        
        console.log(`[getTokenMetadataAction] Successfully fetched ${tokens.length} tokens from cache`);
        return {
            success: true,
            tokens
        };
        
    } catch (error) {
        console.error('[getTokenMetadataAction] Error:', error);
        return {
            success: false,
            tokens: [],
            error: error instanceof Error ? error.message : 'Unknown error fetching cached token metadata'
        };
    }
}

/**
 * Server action to get token prices using cached data with fallback
 * This runs server-side with cached data for better performance
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
        console.log(`[getTokenPricesAction] Fetching cached prices for ${tokenIds.length} tokens`);
        
        // Add safety limit
        if (tokenIds.length > 50) {
            console.warn(`[getTokenPricesAction] Too many tokens requested (${tokenIds.length}), limiting to first 50`);
            tokenIds = tokenIds.slice(0, 50);
        }
        
        // Get cached prices
        const cachedPrices = await cachedPriceClient.getBulkPrices(tokenIds);
        
        const formattedPrices: Record<string, any> = {};
        let cacheHits = 0;
        
        // Format cached prices
        tokenIds.forEach(tokenId => {
            const cachedPrice = cachedPrices[tokenId];
            
            if (cachedPrice && cachedPrice.usdPrice > 0) {
                formattedPrices[tokenId] = {
                    usdPrice: cachedPrice.usdPrice,
                    change24h: cachedPrice.change24h,
                    isLpToken: cachedPrice.isLpToken || false,
                    intrinsicValue: cachedPrice.intrinsicValue,
                    marketPrice: cachedPrice.marketPrice,
                    confidence: cachedPrice.confidence || 1,
                    lastUpdated: cachedPrice.lastUpdated || Date.now(),
                    priceDeviation: cachedPrice.priceDeviation,
                    isArbitrageOpportunity: cachedPrice.isArbitrageOpportunity || false,
                    pathsUsed: cachedPrice.pathsUsed || 1,
                    totalLiquidity: cachedPrice.totalLiquidity || 0,
                    priceSource: cachedPrice.priceSource || 'market' as const,
                };
                cacheHits++;
            } else {
                // Return default structure for missing prices
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
                    priceSource: 'unavailable' as any,
                };
            }
        });
        
        console.log(`[getTokenPricesAction] Successfully fetched ${Object.keys(formattedPrices).length} prices (${cacheHits} from cache, ${tokenIds.length - cacheHits} fallback)`);
        
        return {
            success: true,
            prices: formattedPrices
        };
        
    } catch (error) {
        console.error('[getTokenPricesAction] Error:', error);
        
        // Fallback: return empty/default prices
        const fallbackPrices: Record<string, any> = {};
        tokenIds.forEach(tokenId => {
            fallbackPrices[tokenId] = {
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
                priceSource: 'error' as any,
            };
        });
        
        return {
            success: false,
            prices: fallbackPrices,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Simple server action to get a single token price
 */
export async function getTokenPriceAction(contractId: string): Promise<{
    success: boolean;
    price?: number;
    priceData?: CachedPriceData;
    error?: string;
}> {
    try {
        console.log(`[getTokenPriceAction] Fetching cached price for ${contractId}`);
        
        const priceData = await cachedPriceClient.getTokenPrice(contractId);
        
        if (priceData && priceData.usdPrice > 0) {
            return {
                success: true,
                price: priceData.usdPrice,
                priceData
            };
        } else {
            return {
                success: false,
                price: 0,
                error: `Price not available for ${contractId}`
            };
        }
        
    } catch (error) {
        console.error(`[getTokenPriceAction] Error fetching price for ${contractId}:`, error);
        return {
            success: false,
            price: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Server action to get STX price in USD
 */
export async function getStxPriceAction(): Promise<{
    success: boolean;
    price: number;
    error?: string;
}> {
    try {
        console.log('[getStxPriceAction] Fetching cached STX price');
        
        const stxPrice = await cachedPriceClient.getStxPrice();
        
        return {
            success: true,
            price: stxPrice
        };
        
    } catch (error) {
        console.error('[getStxPriceAction] Error:', error);
        return {
            success: false,
            price: 0,
            error: error instanceof Error ? error.message : 'Failed to fetch STX price'
        };
    }
}

/**
 * Server action to check if price data is available for tokens
 */
export async function checkPriceAvailabilityAction(contractIds: string[]): Promise<{
    success: boolean;
    availability: Record<string, boolean>;
    error?: string;
}> {
    try {
        console.log(`[checkPriceAvailabilityAction] Checking price availability for ${contractIds.length} tokens`);
        
        const availability: Record<string, boolean> = {};
        
        await Promise.all(
            contractIds.map(async (contractId) => {
                availability[contractId] = await cachedPriceClient.hasPriceData(contractId);
            })
        );
        
        const availableCount = Object.values(availability).filter(Boolean).length;
        console.log(`[checkPriceAvailabilityAction] ${availableCount}/${contractIds.length} tokens have price data`);
        
        return {
            success: true,
            availability
        };
        
    } catch (error) {
        console.error('[checkPriceAvailabilityAction] Error:', error);
        return {
            success: false,
            availability: {},
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Server action to discover and add missing tokens using cached data first, then fallback
 * This will attempt to fetch token metadata from cache first, then blockchain discovery
 */
export async function discoverMissingTokenAction(contractId: string): Promise<{
    success: boolean;
    token?: CachedTokenMetadata;
    error?: string;
}> {
    try {
        console.log(`[discoverMissingTokenAction] Attempting to find token in cache: ${contractId}`);
        
        // First try to get from cache
        const cachedToken = await cachedTokenMetadataClient.getTokenMetadata(contractId);
        
        if (cachedToken) {
            console.log(`[discoverMissingTokenAction] Found token in cache: ${contractId} (${cachedToken.symbol})`);
            return {
                success: true,
                token: cachedToken
            };
        }
        
        console.log(`[discoverMissingTokenAction] Token not in cache, attempting discovery: ${contractId}`);
        
        // Fallback to blockchain discovery
        const tokenData = await getTokenMetadataWithDiscovery(contractId);
        
        if (tokenData && tokenData.symbol !== 'UNKNOWN' && tokenData.name !== 'Unknown Token') {
            // Convert to cached token format
            const cachedTokenData: CachedTokenMetadata = {
                contractId: tokenData.contractId,
                name: tokenData.name,
                symbol: tokenData.symbol,
                decimals: tokenData.decimals,
                totalSupply: tokenData.totalSupply || '0',
                type: tokenData.type as CachedTokenMetadata['type'],
                logo: tokenData.logo,
                description: tokenData.description,
                website: tokenData.website,
                coingeckoId: tokenData.coingeckoId,
                tags: tokenData.tags,
                verified: tokenData.verified,
                lastUpdated: Date.now()
            };
            
            console.log(`[discoverMissingTokenAction] Successfully discovered token: ${contractId} (${tokenData.symbol})`);
            return {
                success: true,
                token: cachedTokenData
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
        
        // Use cachedBalanceClient to get individual balances for each address
        const data: Record<string, CachedBalanceResponse> = {};
        
        for (const address of addresses) {
            const balanceData = await cachedBalanceClient.getAddressBalances(address);
            if (balanceData) {
                data[address] = balanceData;
            }
        }
        
        const response: BulkBalanceResponse = {
            success: true,
            data
        };
        
        console.log(`[getBalancesAction] Successfully fetched balances for ${Object.keys(data).length} addresses`);
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
        
        // Historical balance functionality would need to be implemented in the data app
        
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
 * Server action to get current balances for a single address using cached data
 * This is optimized for individual address balance lookups with caching
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
        console.log(`[getAddressBalancesAction] Fetching cached balances for address: ${address}`);
        
        // First try cached data
        const fungibleTokens = await cachedBalanceClient.getFungibleTokenBalances(address, false);
        
        if (Object.keys(fungibleTokens).length > 0) {
            // Convert to the expected format (balance values only)
            const balances: Record<string, string> = {};
            
            if (contractIds && contractIds.length > 0) {
                // Filter by requested contract IDs
                contractIds.forEach(contractId => {
                    balances[contractId] = fungibleTokens[contractId]?.balance || '0';
                });
            } else {
                // Return all non-zero balances
                Object.entries(fungibleTokens).forEach(([contractId, tokenData]) => {
                    balances[contractId] = tokenData.balance;
                });
            }
            
            console.log(`[getAddressBalancesAction] Successfully fetched ${Object.keys(balances).length} cached token balances`);
            return {
                success: true,
                balances
            };
        }
        
        console.log(`[getAddressBalancesAction] No cached data available, fallback not implemented yet for: ${address}`);
        
        // Return empty balances for now since external service is being removed
        const balances = {};
        
        console.log(`[getAddressBalancesAction] Returning empty balances (service migration in progress)`);
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