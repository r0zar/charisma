"use client";
import dynamic from 'next/dynamic';
import { useDominantColor } from './utils/useDominantColor';
import { TokenCacheData } from '@/lib/contract-registry-adapter';

const ConditionTokenChart = dynamic(() => import('./condition-token-chart'), { ssr: false });

interface Props {
    token: TokenCacheData | null;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    direction?: 'lt' | 'gt';
    onTargetPriceChange: (p: string) => void;
}

export default function ConditionTokenChartWrapper({ token, baseToken, targetPrice, direction, onTargetPriceChange }: Props) {
    const colour = useDominantColor(token?.image);

    if (!token) return null;

    return (
        <ConditionTokenChart
            token={token}
            baseToken={baseToken}
            targetPrice={targetPrice}
            direction={direction}
            onTargetPriceChange={onTargetPriceChange}
            colour={colour ?? '#3b82f6'}
        />
    );
}
