'use client';

import React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { TokenPriceData } from '@/lib/pricing/price-calculator';
import { TokenNode } from '@/lib/pricing/price-graph';

interface TokenMeta {
  contractId: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenMetricsProps {
  tokenMeta: TokenMeta;
  priceData: TokenPriceData | null;
  tokenNode: TokenNode | null;
  poolCount: number;
}

const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined || isNaN(price)) {
    return 'N/A';
  }
  
  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(4)}`;
  } else if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  } else {
    return `$${price.toExponential(2)}`;
  }
};

const formatLiquidity = (liquidity: number | null | undefined): string => {
  if (liquidity === null || liquidity === undefined || isNaN(liquidity)) {
    return 'N/A';
  }
  
  if (liquidity >= 1000000) {
    return `$${(liquidity / 1000000).toFixed(2)}M`;
  } else if (liquidity >= 1000) {
    return `$${(liquidity / 1000).toFixed(1)}K`;
  } else {
    return `$${liquidity.toFixed(0)}`;
  }
};

const getConfidenceColorScheme = (confidence: number | null): 'success' | 'warning' | 'danger' | 'default' => {
  if (confidence === null || confidence === undefined) return 'default';
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'danger';
};

const getMarketRank = (poolCount: number): { rank: string; description: string } => {
  if (poolCount >= 5) {
    return { rank: 'Major', description: 'High liquidity token' };
  } else if (poolCount >= 3) {
    return { rank: 'Mid-tier', description: 'Moderate liquidity' };
  } else if (poolCount >= 1) {
    return { rank: 'Emerging', description: 'Limited liquidity' };
  } else {
    return { rank: 'Unlisted', description: 'No active pools' };
  }
};

export default function TokenMetrics({ 
  tokenMeta, 
  priceData, 
  tokenNode, 
  poolCount 
}: TokenMetricsProps) {
  const marketInfo = getMarketRank(poolCount);
  const confidenceColorScheme = getConfidenceColorScheme(priceData?.confidence || null);
  
  // Calculate price precision indicator
  const pricePrecision = React.useMemo(() => {
    if (!priceData?.usdPrice) return 'N/A';
    
    const price = priceData.usdPrice;
    if (price >= 1) return 'Standard';
    if (price >= 0.0001) return 'Micro';
    return 'Nano';
  }, [priceData?.usdPrice]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Current Price */}
      <StatCard
        title="Current Price"
        value={formatPrice(priceData?.usdPrice)}
        icon="dollar"
        description={`Precision: ${pricePrecision}`}
        colorScheme="primary"
        change={priceData?.calculationDetails?.priceVariation ? {
          value: priceData.calculationDetails.priceVariation,
          direction: priceData.calculationDetails.priceVariation > 0 ? 'up' : 'down',
          label: 'variation'
        } : undefined}
      />

      {/* Market Position */}
      <StatCard
        title="Market Position"
        value={marketInfo.rank}
        icon="trending"
        description={marketInfo.description}
        colorScheme={poolCount >= 3 ? 'success' : poolCount >= 1 ? 'warning' : 'danger'}
      />

      {/* sBTC Ratio */}
      <StatCard
        title="sBTC Ratio"
        value={priceData?.sbtcRatio ? priceData.sbtcRatio.toFixed(8) : 'N/A'}
        icon="coins"
        description="Bitcoin-anchored rate"
        colorScheme="secondary"
      />

      {/* Price Confidence */}
      <StatCard
        title="Price Confidence"
        value={priceData?.confidence ? `${(priceData.confidence * 100).toFixed(1)}%` : 'N/A'}
        icon="activity"
        description={`${priceData?.calculationDetails?.pathsUsed || 0} paths analyzed`}
        colorScheme={confidenceColorScheme}
      />
    </div>
  );
}