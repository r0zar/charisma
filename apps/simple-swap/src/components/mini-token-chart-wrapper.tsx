"use client";
import dynamic from 'next/dynamic';
import React from 'react';
import type { Token } from '../lib/swap-client';

const MiniTokenChart = dynamic(() => import('./mini-token-chart'), { ssr: false });

export default function MiniTokenChartWrapper({ tokens }: { tokens: Token[] }) {
    if (!tokens.length) return null;
    return <MiniTokenChart tokens={tokens} />;
} 