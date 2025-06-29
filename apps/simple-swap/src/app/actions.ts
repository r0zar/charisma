'use server';

import { kv } from "@vercel/kv";
import { processSingleBlazeIntentByPid } from "@/lib/blaze-intent-server"; // Adjust path as needed
import { callReadOnlyFunction } from "@repo/polyglot";
import { principalCV } from "@stacks/transactions";
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