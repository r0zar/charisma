'use client';

import { usePrices } from '@/contexts/token-price-context';
import React, { useMemo } from 'react';

const CHA_CONTRACT_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

export default function CharismaQuote() {
    const { getPrice } = usePrices();

    const rate = useMemo(() => {
        const stxPrice = getPrice('.stx');
        const chaPrice = getPrice(CHA_CONTRACT_ID);

        if (!stxPrice || !chaPrice || stxPrice === 0) {
            return '';
        }

        // Calculate how many CHA tokens you get for 1 STX
        const chaPerStx = stxPrice / chaPrice;
        const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(chaPerStx);

        return `1 STX = ${formatted} CHA`;
    }, [getPrice]);

    return <span className="font-medium">{rate}</span>;
} 