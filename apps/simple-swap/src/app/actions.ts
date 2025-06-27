'use server';

import { kv } from "@vercel/kv";
import { processSingleBlazeIntentByPid } from "@/lib/blaze-intent-server"; // Adjust path as needed
import { callReadOnlyFunction } from "@repo/polyglot";
import { principalCV, uintCV, optionalCVOf } from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { loadVaults, Router, listTokens as listSwappableTokens } from 'dexterity-sdk'
import { TokenCacheData } from "@repo/tokens";

// Configure Dexterity router
const routerAddress = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const routerName = process.env.NEXT_PUBLIC_ROUTER_NAME || 'multihop';

const router = new Router({
    maxHops: 4,
    defaultSlippage: 0.05,
    debug: process.env.NODE_ENV === 'development',
    routerContractId: `${routerAddress}.${routerName}`,
});

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
 * For swap mode, includes both tradeable tokens and L1 LP tokens (and down).
 * The client can render token names/symbols immediately without extra processing.
 */
export async function listTokens(): Promise<{
    success: boolean;
    tokens?: TokenCacheData[];
    error?: string;
}> {
    try {
        // For swap mode, we want tradeable tokens + L0 LP tokens and down
        // since LP tokens can now be "burned" as part of swaps
        const dexCacheApiUrl = process.env.DEX_CACHE_API_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3003' : 'https://invest.charisma.rocks');
        const response = await fetch(`${dexCacheApiUrl}/api/v1/tokens/all?type=all&nestLevel=0&includePricing=true`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();

        // for some reason this is failing good data responses
        // if (!result.success || !result.data) {
        //     throw new Error(result.error || 'Failed to fetch tokens');
        // }

        // Transform the unified token format to TokenCacheData format
        const tokens: TokenCacheData[] = result.data.map((token: any) => ({
            contractId: token.contractId,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            image: token.image,
            description: token.description,
            supply: token.supply,
            // Determine type based on whether it's an LP token
            type: token.isLpToken ? 'POOL' : 'FT',
            // Add nest level information for LP tokens
            nestLevel: token.nestLevel,
            // Add pricing if available
            usdPrice: token.usdPrice ?? token.price,
            confidence: token.confidence,
            marketPrice: token.marketPrice,
            intrinsicValue: token.intrinsicValue,
            totalLiquidity: token.totalLiquidity,
            lastUpdated: token.lastUpdated,
            // Mark as LP token with additional properties if applicable
            ...(token.isLpToken && {
                properties: {
                    isLpToken: true,
                    nestLevel: token.nestLevel,
                    // Include LP metadata for burn-swap operations
                    lpMetadata: token.lpMetadata,
                    // Include underlying token info for LP tokens
                    tokenAContract: token.lpMetadata?.tokenA?.contractId,
                    tokenBContract: token.lpMetadata?.tokenB?.contractId
                }
            }),
            // Add trading metadata if available
            ...(token.tradingMetadata && {
                tradingMetadata: token.tradingMetadata
            })
        }));

        console.log(`[listTokens] Loaded ${tokens.length} tokens from unified API (${result.metadata.tradeableTokens} tradeable, ${result.metadata.lpTokens} LP)`);

        return {
            success: true,
            tokens
        };
    } catch (error) {
        console.error('[listTokens] Error fetching from unified API, falling back to dexterity SDK:', error);

        // Fallback to existing implementation
        try {
            const tokens = await listSwappableTokens();

            console.log('🔍 listTokens: tokens', tokens);
            return {
                success: true,
                tokens: tokens as any as TokenCacheData[]
            };
        } catch (fallbackError) {
            console.error('[listTokens] Fallback also failed:', fallbackError);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch tokens'
            };
        }
    }
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
        return Number(result?.value);
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

const OP_REMOVE_LIQUIDITY = '03'; // Opcode for remove liquidity

/**
 * Server action to get remove liquidity quote for LP burn-swap calculations
 */
export async function getRemoveLiquidityQuote(
    vaultContractId: string,
    targetLpAmountToBurn: number
): Promise<{ success: boolean; error?: string; quote?: { dx: number; dy: number; dk: number } | null }> {
    try {
        if (targetLpAmountToBurn <= 0) {
            return { success: true, quote: null };
        }

        const [contractAddress, contractName] = vaultContractId.split('.');
        if (!contractAddress || !contractName) {
            throw new Error(`Invalid vault contract ID: ${vaultContractId}`);
        }

        const result = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'quote',
            [
                uintCV(targetLpAmountToBurn),
                optionalCVOf(bufferFromHex(OP_REMOVE_LIQUIDITY))
            ]
        );

        if (result && typeof result === 'object' && 'value' in result) {
            const quoteValue = result.value as any;
            // Parse the response structure to match dex-cache implementation
            if (quoteValue && quoteValue.dx !== undefined && quoteValue.dy !== undefined) {
                return {
                    success: true,
                    quote: {
                        dx: Number(quoteValue.dx.value || quoteValue.dx || 0),
                        dy: Number(quoteValue.dy.value || quoteValue.dy || 0),
                        dk: Number(quoteValue.dk?.value || quoteValue.dk || targetLpAmountToBurn)
                    }
                };
            }
        }

        return { success: true, quote: null };
    } catch (error: any) {
        console.error("Error in getRemoveLiquidityQuote:", error);
        return {
            success: false,
            error: error.message || "Failed to fetch remove liquidity quote"
        };
    }
}