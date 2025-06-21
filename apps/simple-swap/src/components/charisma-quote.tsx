'use client';

import React, { useMemo } from 'react';
import { useBlaze } from 'blaze-sdk/realtime';

const CHA_CONTRACT_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

export default function CharismaQuote() {
    const { prices } = useBlaze({});

    const rate = useMemo(() => {
        const stxPrice = prices['stx']?.price;
        const chaPrice = prices[CHA_CONTRACT_ID]?.price;
        
        if (!stxPrice || !chaPrice || stxPrice === 0) {
            return '';
        }

        // Calculate how many CHA tokens you get for 1 STX
        const chaPerStx = stxPrice / chaPrice;
        const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(chaPerStx);
        
        return `1 STX = ${formatted} CHA`;
    }, [prices]);

    return <span className="font-medium">{rate}</span>;
} 