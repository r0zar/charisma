'use client';

import { useState, useEffect } from 'react';
import { getAccountBalances } from '@repo/polyglot';
import { getBatchLpTotalSupplies } from '@/app/actions';
import type { Vault } from '@/lib/pool-service';
import type { KraxelPriceData } from '@repo/tokens';

/**
 * Computes the user's USD position value for each vault based on their LP token share.
 *
 * Returns positions map: contractId → USD value (or null if user has no position / missing data).
 */
export function useUserPoolPositions(
    stxAddress: string | null,
    vaults: Vault[],
    prices: KraxelPriceData | null
): { positions: Record<string, number | null>; loading: boolean } {
    const [positions, setPositions] = useState<Record<string, number | null>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!stxAddress || vaults.length === 0) {
            setPositions({});
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const compute = async () => {
            try {
                const vaultIds = vaults.map(v => v.contractId);

                // Fetch user balances and LP total supplies in parallel
                const [accountData, totalSupplies] = await Promise.all([
                    getAccountBalances(stxAddress, { trim: true }),
                    getBatchLpTotalSupplies(vaultIds),
                ]);

                if (cancelled) return;

                // Build a quick-lookup map from the Hiro balances response
                const userBalances: Record<string, number> = {};
                if (accountData?.fungible_tokens) {
                    for (const [tokenId, data] of Object.entries(accountData.fungible_tokens)) {
                        if (typeof data === 'object' && data && 'balance' in data) {
                            userBalances[tokenId] = Number((data as any).balance);
                        }
                    }
                }

                const result: Record<string, number | null> = {};

                for (const vault of vaults) {
                    const lpBalance = userBalances[vault.contractId] ?? 0;

                    if (lpBalance <= 0) {
                        result[vault.contractId] = null;
                        continue;
                    }

                    const totalSupply = totalSupplies[vault.contractId];
                    if (!totalSupply || totalSupply <= 0) {
                        result[vault.contractId] = null;
                        continue;
                    }

                    const share = lpBalance / totalSupply;

                    // Compute USD value of user's share of reserves
                    const reservesA = vault.reservesA ?? 0;
                    const reservesB = vault.reservesB ?? 0;
                    const tokenAId = vault.tokenA?.contractId;
                    const tokenBId = vault.tokenB?.contractId;
                    const decimalsA = vault.tokenA?.decimals ?? 0;
                    const decimalsB = vault.tokenB?.decimals ?? 0;

                    let usdValue: number | null = null;

                    const priceA = tokenAId && prices ? prices[tokenAId] : undefined;
                    const priceB = tokenBId && prices ? prices[tokenBId] : undefined;

                    if (priceA !== undefined) {
                        usdValue = (usdValue ?? 0) + (reservesA / Math.pow(10, decimalsA)) * share * priceA;
                    }
                    if (priceB !== undefined) {
                        usdValue = (usdValue ?? 0) + (reservesB / Math.pow(10, decimalsB)) * share * priceB;
                    }

                    result[vault.contractId] = usdValue;
                }

                if (!cancelled) {
                    setPositions(result);
                }
            } catch (error) {
                console.error('Failed to compute user pool positions:', error);
                if (!cancelled) {
                    setPositions({});
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        compute();

        return () => {
            cancelled = true;
        };
    }, [stxAddress, vaults, prices]);

    return { positions, loading };
}
