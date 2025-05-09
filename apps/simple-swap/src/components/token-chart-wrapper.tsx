'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const TokenChart = dynamic(() => import('./token-chart'), { ssr: false });

interface Props {
    primary: string;
    compareId: string | null;
    primaryColor: string;
    compareColor: string;
}

export default function TokenChartWrapper({ primary, compareId, primaryColor, compareColor }: Props) {
    return <TokenChart primary={primary} compareId={compareId} primaryColor={primaryColor} compareColor={compareColor} />;
} 