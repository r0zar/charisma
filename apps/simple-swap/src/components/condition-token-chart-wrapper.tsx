"use client";
import dynamic from 'next/dynamic';
import React, { memo, useMemo, useCallback } from 'react';
import { useDominantColor } from './utils/useDominantColor';
import { TokenCacheData } from '@repo/tokens';

const ConditionTokenChart = dynamic(() => import('./condition-token-chart'), { ssr: false });

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    direction?: 'lt' | 'gt';
    onTargetPriceChange: (p: string) => void;
}

function ConditionTokenChartWrapper({ token, baseToken, targetPrice, direction, onTargetPriceChange }: Props) {
    if (!token) return null;
    
    const domColour = useDominantColor(token?.image);
    const colour = useMemo(() => domColour ?? '#3b82f6', [domColour]);
    
    // Memoize the target price change handler to prevent unnecessary rerenders
    const handleTargetPriceChange = useCallback((price: string) => {
        onTargetPriceChange(price);
    }, [onTargetPriceChange]);
    
    return (
        <ConditionTokenChart 
            token={token} 
            baseToken={baseToken} 
            targetPrice={targetPrice} 
            direction={direction}
            onTargetPriceChange={handleTargetPriceChange} 
            colour={colour} 
        />
    );
}

// Memoize the component to prevent rerenders when props haven't changed
export default memo(ConditionTokenChartWrapper, (prevProps, nextProps) => {
    return (
        prevProps.token?.contractId === nextProps.token?.contractId &&
        prevProps.baseToken?.contractId === nextProps.baseToken?.contractId &&
        prevProps.targetPrice === nextProps.targetPrice &&
        prevProps.direction === nextProps.direction &&
        prevProps.token?.image === nextProps.token?.image
    );
}); 