/**
 * Post Conditions Utilities
 * 
 * This module provides functions for building post conditions for multihop swap transactions.
 * Post conditions ensure that contracts can only send tokens within specified limits.
 */

import {
    PostCondition,
    Pc,
} from '@stacks/transactions';
import { STX_CONTRACT_ID, WRAPPED_STX_CONTRACT_ID } from '../../../constants';

// ====== Types ======

export interface Token {
    contractId: string;    // Format: "address.contract-name"
    identifier?: string;   // Optional token identifier for FTs
    type: string;
}

export interface Hop {
    tokenIn: Token;        // Input token for this hop
    tokenOut: Token;       // Output token for this hop
    vault: {               // Vault contract that performs the swap
        contractId: string;
        externalPoolId?: string;
        type: string;
    };
    opcode: number;        // Opcode for the vault operation
    quote?: {              // Optional quote information
        amountIn: string | number;
        amountOut: string | number;
    };
}

export interface Route {
    path: Token[];         // Complete token path (including intermediaries)
    hops: Hop[];           // Swap hops in the route
}

// ====== Helper Functions ======

/**
 * Checks if a token is a subnet token
 * 
 * @param token - The token to check
 * @returns True if the token is a subnet token
 */
function isSubnet(token: Token): boolean {
    return token.type === 'SUBNET';
}

/**
 * Checks if a vault is a sublink vault
 * 
 * @param vault - The vault to check
 * @returns True if the vault is a sublink vault
 */
function isSublink(vault: { type: string }): boolean {
    return vault.type === 'SUBLINK';
}

/**
 * Gets the principal that will send output tokens for a hop
 * 
 * @param hop - The hop to get the output principal for
 * @returns The contract ID that will send the output tokens
 */
function getOutputPrincipal(hop: Hop): string {
    if (hop.vault.externalPoolId) {
        return hop.vault.externalPoolId;
    }

    return isSublink(hop.vault)
        ? hop.tokenIn.contractId
        : hop.vault.contractId;
}

/**
 * Checks if a token ID represents STX (native or wrapped)
 * 
 * @param tokenId - The token ID to check
 * @returns True if the token ID represents STX or wrapped STX
 */
function isStx(tokenId: string): boolean {
    return tokenId === STX_CONTRACT_ID || tokenId === WRAPPED_STX_CONTRACT_ID;
}

/**
 * Gets the asset ID for a token
 * 
 * @param token - The token to get the asset ID for
 * @returns The asset ID
 */
function getAssetId(token: Token): string {
    return `${token.contractId}${token.identifier ? '::' + token.identifier : ''}`;
}

// ====== Post Condition Builder ======

/**
 * Helper class to build and manage post conditions
 */
class PostConditionBuilder {
    private lteMap = new Map<string, bigint>(); // Input operations - willSendLte (spending)
    private gteMap = new Map<string, bigint>(); // Output operations - willSendGte (receiving)

    constructor(private slippage: number = 1) { }

    /**
     * Add a LTE post condition (spending operation)
     */
    addLte(principal: string, tokenId: string, amount: bigint): void {
        const key = `${principal}|${tokenId}`;
        this.lteMap.set(key, (this.lteMap.get(key) ?? BigInt(0)) + amount);
    }

    /**
     * Add a GTE post condition (receiving operation)
     */
    addGte(principal: string, tokenId: string, amount: bigint): void {
        const key = `${principal}|${tokenId}`;
        this.gteMap.set(key, (this.gteMap.get(key) ?? BigInt(0)) + amount);
    }

    /**
     * Apply slippage to an amount for LTE operations (allow spending more)
     */
    applyLteSlippage(amount: bigint): bigint {
        const slippageUpMultiplier = BigInt(Math.floor((100 + this.slippage) * 100));
        const slippageDivisor = BigInt(10000);
        return (amount * slippageUpMultiplier) / slippageDivisor;
    }

    /**
     * Apply slippage to an amount for GTE operations (require receiving minimum)
     */
    applyGteSlippage(amount: bigint): bigint {
        const slippageDownMultiplier = BigInt(Math.floor((100 - this.slippage) * 100));
        const slippageDivisor = BigInt(10000);
        return (amount * slippageDownMultiplier) / slippageDivisor;
    }

    /**
     * Build the final post conditions array
     */
    build(): PostCondition[] {
        const postConditions: PostCondition[] = [];

        // Create LTE post conditions (spending operations - allow spending up to amount + slippage)
        this.lteMap.forEach((amount, key) => {
            const [principal, tokenId] = key.split('|');
            console.log('LTE post condition:', principal, tokenId, amount);

            if (isStx(tokenId)) {
                postConditions.push(Pc.principal(principal).willSendLte(amount).ustx());
            } else {
                const [contractPart, identPart] = tokenId.split('::');
                postConditions.push(Pc.principal(principal).willSendLte(amount).ft(contractPart as any, identPart));
            }
        });

        // Create GTE post conditions (receiving operations - require receiving at least amount - slippage)
        this.gteMap.forEach((amount, key) => {
            const [principal, tokenId] = key.split('|');
            console.log('GTE post condition:', principal, tokenId, amount);

            if (isStx(tokenId)) {
                postConditions.push(Pc.principal(principal).willSendGte(amount).ustx());
            } else {
                const [contractPart, identPart] = tokenId.split('::');
                postConditions.push(Pc.principal(principal).willSendGte(amount).ft(contractPart as any, identPart));
            }
        });

        return postConditions;
    }
}

// ====== Post Condition Building ======

/**
 * Builds post conditions for a swap transaction
 * Post conditions only care about what contracts are sending what tokens and in what amounts
 * 
 * @param route - The route to execute
 * @param routerCID - The contract ID of the router
 * @param slippage - Optional slippage percentage (default: 1%)
 * @returns The post conditions
 */
export function buildPostConditions(route: Route, routerCID: string, slippage: number = 1): PostCondition[] {
    const builder = new PostConditionBuilder(slippage);

    // Process each hop: router sends input tokens, vault sends output tokens back
    route.hops.forEach((hop) => {
        const amtIn = BigInt(hop.quote?.amountIn ?? 0);
        const amtOut = BigInt(hop.quote?.amountOut ?? 0);

        // Router sends input tokens to vault (LTE with slippage buffer - allow spending more)
        if (!isSubnet(hop.tokenIn)) {
            const amtInWithSlippage = builder.applyLteSlippage(amtIn);
            builder.addLte(routerCID, getAssetId(hop.tokenIn), amtInWithSlippage);
        }

        // Vault sends output tokens back to router (GTE with slippage protection - require receiving minimum)
        if (!isSubnet(hop.tokenOut)) {
            const outputPrincipal = getOutputPrincipal(hop);
            const amtOutWithSlippage = builder.applyGteSlippage(amtOut);
            builder.addGte(outputPrincipal, getAssetId(hop.tokenOut), amtOutWithSlippage);
        }
    });

    // Router sends final output tokens to user (GTE with slippage protection - guarantee minimum to user)
    const transferToken = route.path[route.path.length - 1];
    if (!isSubnet(transferToken)) {
        const lastHop = route.hops[route.hops.length - 1];
        const finalAmountOut = BigInt(lastHop.quote?.amountOut ?? 0);
        const finalAmountWithSlippage = builder.applyGteSlippage(finalAmountOut);
        builder.addGte(routerCID, getAssetId(transferToken), finalAmountWithSlippage);
    }

    return builder.build();
}