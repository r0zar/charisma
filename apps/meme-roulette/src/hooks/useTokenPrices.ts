'use client';

import { useState, useEffect } from 'react';
import { listPrices, type KraxelPriceData } from '@repo/tokens';

// CHA token contract ID
const CHA_TOKEN_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token";

interface TokenPrices {
    cha?: number;
    [key: string]: number | undefined;
}

export function useTokenPrices() {
    const [prices, setPrices] = useState<TokenPrices>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function fetchPrices() {
            try {
                setIsLoading(true);
                setError(null);

                const priceData: KraxelPriceData = await listPrices();

                if (!mounted) return;

                const formattedPrices: TokenPrices = {
                    cha: priceData[CHA_TOKEN_CONTRACT]
                };

                setPrices(formattedPrices);
            } catch (err) {
                if (!mounted) return;
                console.error('Failed to fetch token prices:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch prices');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchPrices();

        // Refresh prices every 2 minutes
        const interval = setInterval(fetchPrices, 2 * 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return {
        prices,
        isLoading,
        error,
        chaPrice: prices.cha
    };
} 