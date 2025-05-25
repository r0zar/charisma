"use client";
import dynamic from 'next/dynamic';
import React from 'react';
import { useDominantColor } from './utils/useDominantColor';
import { TokenCacheData } from '@repo/tokens';

const ConditionTokenChart = dynamic(() => import('./condition-token-chart'), { ssr: false });

export default function ConditionTokenChartWrapper({ token, baseToken, targetPrice, onTargetPriceChange }: { token: TokenCacheData; baseToken?: TokenCacheData | null; targetPrice: string; onTargetPriceChange: (p: string) => void }) {
    if (!token) return null;
    const domColour = useDominantColor(token.image);
    const colour = domColour ?? '#3b82f6';
    return <ConditionTokenChart token={token} baseToken={baseToken} targetPrice={targetPrice} onTargetPriceChange={onTargetPriceChange} colour={colour} />;
} 