"use client";
import dynamic from 'next/dynamic';
import React from 'react';
import type { Token } from '../lib/swap-client';
import { useDominantColor } from './utils/useDominantColor';

const ConditionTokenChart = dynamic(() => import('./condition-token-chart'), { ssr: false });

export default function ConditionTokenChartWrapper({ token, baseToken, targetPrice, onTargetPriceChange }: { token: Token; baseToken?: Token | null; targetPrice: string; onTargetPriceChange: (p: string) => void }) {
    if (!token) return null;
    const domColour = useDominantColor(token.image);
    const colour = domColour ?? '#3b82f6';
    return <ConditionTokenChart token={token} baseToken={baseToken} targetPrice={targetPrice} onTargetPriceChange={onTargetPriceChange} colour={colour} />;
} 