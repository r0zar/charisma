'use server';

import { Dexterity, Route } from "@/lib/dexterity-client";
import { QuoteResponse } from "../lib/swap-client";
import type { Token } from "../lib/swap-client";

// Configure Dexterity router
const routerAddress = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const routerName = process.env.NEXT_PUBLIC_ROUTER_NAME || 'multihop';
Dexterity.configureRouter(
    routerAddress,
    routerName,
    {
        maxHops: 2,
        debug: true,
        defaultSlippage: 0.01,
    });

// Make sure to initialize Dexterity
if (typeof window === 'undefined') { // Server-side only
    Dexterity.init({
        apiKey: process.env.HIRO_API_KEY!,
        debug: true,
    });
}

// Keep track of vault loading status
let vaultsLoaded = false;

// Get the omit list from environment variables (comma-separated)
const vaultOmitListString = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sub-link-vault-v7';
const vaultOmitSet = new Set(vaultOmitListString.split(',').map(id => id.trim()).filter(id => id));

if (vaultOmitSet.size > 0) {
    console.log(`[Server] Vault Omit List active: Excluding ${vaultOmitSet.size} vaults:`, Array.from(vaultOmitSet));
}

/**
 * Load vaults into Dexterity if not already loaded
 */
export async function ensureVaultsLoaded() {
    if (vaultsLoaded) return;

    console.log('[Server] Discovering and loading vaults into Dexterity...');
    try {
        // Fetch vaults from dex-cache API first
        const dexCacheUrl = process.env.NEXT_PUBLIC_DEX_CACHE_URL || 'http://localhost:3003/api/v1';
        const response = await fetch(`${dexCacheUrl}/vaults`);

        if (response.ok) {
            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.data)) {
                // Filter the vaults based on the omit list
                const allVaults = data.data;
                const filteredVaults = allVaults.filter((vault: any) => !vaultOmitSet.has(vault.contractId));

                const omittedCount = allVaults.length - filteredVaults.length;
                if (omittedCount > 0) {
                    console.log(`[Server] Omitted ${omittedCount} vaults based on the list.`);
                }

                console.log(`[Server] Loading ${filteredVaults.length} vaults from dex-cache after filtering`);
                Dexterity.loadVaults(filteredVaults); // Load only the filtered vaults
                vaultsLoaded = true;
                return;
            }
        }
        // If fetching or filtering fails, still mark as loaded to avoid retries, but log it.
        console.warn('[Server] Could not load vaults from dex-cache or data was invalid. Proceeding without cached vaults.');
        vaultsLoaded = true;
    } catch (error) {
        console.error('[Server] Error loading vaults:', error);
        throw new Error('Failed to load vaults for routing');
    }
}

/**
 * Server action to get a swap quote using Dexterity directly
 */
export async function getQuote(
    fromTokenId: string,
    toTokenId: string,
    amount: string | number
): Promise<{ success: boolean; data?: QuoteResponse; error?: string }> {
    try {
        console.log(`[Server] Getting quote for ${fromTokenId} -> ${toTokenId} with amount ${amount}`);

        // Make sure vaults are loaded
        await ensureVaultsLoaded();

        // Convert amount to number if it's a string
        const amountNum = typeof amount === 'string' ? parseInt(amount, 10) : amount;

        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error('Invalid amount');
        }

        // Get quote directly from Dexterity
        const quoteResult = await Dexterity.getQuote(fromTokenId, toTokenId, amountNum);

        // Handle error case
        if (quoteResult instanceof Error) {
            throw quoteResult;
        }

        console.log(`[Server] Quote generated using Dexterity directly`);

        return {
            success: true,
            data: quoteResult
        };
    } catch (error) {
        console.error('[Server] Error generating quote with Dexterity:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Server action to execute a swap using Dexterity directly
 */
export async function executeSwap(route: Route): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
        console.log(`[Server] Executing swap with route: ${JSON.stringify(route).substring(0, 100)}...`);

        // Make sure vaults are loaded
        await ensureVaultsLoaded();

        // Execute the swap using Dexterity
        const result = await Dexterity.executeSwapRoute(route);

        if (result instanceof Error) {
            throw result;
        }

        // Handle different return types from Dexterity
        const txId = typeof result === 'string'
            ? result
            : `tx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

        return {
            success: true,
            txId
        };
    } catch (error) {
        console.error('[Server] Error executing swap:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
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
    try {
        // Make sure vaults are loaded
        await ensureVaultsLoaded();

        // Get all tokens from the Dexterity graph
        const graphStats = Dexterity.getGraphStats();
        const tokenIds = graphStats.tokenIds;

        console.log(`[Server] Found ${tokenIds.length} tokens in the routing graph`);

        // Only return the contract IDs - the client will fetch full details
        return {
            success: true,
            tokens: tokenIds.map(id => ({ contractId: id }))
        };
    } catch (error) {
        console.error('[Server] Error getting routable tokens:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Server action to retrieve full token metadata (not just contract IDs).
 * The client can render token names/symbols immediately without extra processing.
 */
export async function listTokens(): Promise<{
    success: boolean;
    tokens?: Token[];
    error?: string;
}> {
    try {
        await ensureVaultsLoaded();

        // Use Dexterity helper to collect unique tokens from loaded vaults
        const vaults = Dexterity.getVaults();
        const tokens = Dexterity.getAllVaultTokens(vaults);

        return {
            success: true,
            tokens: tokens as Token[]
        };
    } catch (error) {
        console.error('[Server] Error listing tokens:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
} 