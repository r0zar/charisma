'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  PieChart,
  AlertTriangle,
  Target,
  Droplets
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoolEdge } from '@/lib/pricing/price-graph';
import { TokenNode } from '@/lib/pricing/price-graph';
import {
  getTokenDecimals,
  convertAtomicToDecimal
} from '@/lib/pricing/decimal-utils';
import {
  type TokenMeta as UITokenMeta,
  getTokenDecimalsFromMeta
} from '@/lib/ui-decimal-utils';

interface LiquidityAnalysisProps {
  tokenSymbol: string;
  pools: PoolEdge[];
  tokenNode: TokenNode | null;
  totalLiquidity: number;
  allTokenNodes: TokenNode[]; // Added to get decimal information
  allTokens: UITokenMeta[]; // Add token metadata for proper symbol resolution
}

interface PoolLiquidityData {
  poolId: string;
  liquidityUsd: number;
  percentage: number;
  pairedToken: string;
  riskLevel: 'low' | 'medium' | 'high';
}

const formatLiquidity = (liquidity: number): string => {
  // Format USD liquidity values for display
  if (liquidity === 0) {
    return 'N/A';
  }
  
  if (liquidity >= 1e9) {
    return `$${(liquidity / 1e9).toFixed(2)}B`;
  } else if (liquidity >= 1e6) {
    return `$${(liquidity / 1e6).toFixed(2)}M`;
  } else if (liquidity >= 1e3) {
    return `$${(liquidity / 1e3).toFixed(1)}K`;
  } else if (liquidity >= 1) {
    return `$${liquidity.toFixed(2)}`;
  } else if (liquidity >= 0.01) {
    return `$${liquidity.toFixed(4)}`;
  } else {
    return `$${liquidity.toExponential(2)}`;
  }
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'low': return 'text-emerald-500 bg-emerald-500/20';
    case 'medium': return 'text-amber-500 bg-amber-500/20';
    case 'high': return 'text-rose-500 bg-rose-500/20';
    default: return 'text-muted-foreground bg-muted/20';
  }
};

const getTokenSymbol = (tokenId: string, allTokens: UITokenMeta[]): string => {
  // First try to find the token in metadata
  const token = allTokens.find(t => t.contractId === tokenId);
  if (token?.symbol) {
    return token.symbol;
  }
  
  // Fallback to hardcoded values for known tokens
  if (tokenId === '.stx') return 'STX';
  if (tokenId.includes('sbtc-token')) return 'sBTC';
  if (tokenId.includes('charisma-token')) return 'CHA';
  if (tokenId.includes('dme000-governance-token')) return 'DMG';
  
  const parts = tokenId.split('.');
  const lastPart = parts[parts.length - 1];
  
  if (lastPart.includes('token')) {
    return lastPart.replace('-token', '').replace('token', '').toUpperCase().slice(0, 4);
  }
  
  return lastPart.slice(0, 4).toUpperCase();
};

const LiquidityDistributionChart = ({ data }: { data: PoolLiquidityData[] }) => {
  const colors = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // purple-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#ef4444'  // red-500
  ];

  const colorClasses = [
    'bg-blue-500',
    'bg-emerald-500', 
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-red-500'
  ];

  // Calculate pie chart segments
  const centerX = 120;
  const centerY = 120;
  const radius = 100;
  
  let cumulativePercentage = 0;
  const segments = data.map((pool, index) => {
    const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((cumulativePercentage + pool.percentage) / 100) * 2 * Math.PI - Math.PI / 2;
    
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);
    
    const largeArcFlag = pool.percentage > 50 ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    cumulativePercentage += pool.percentage;
    
    return {
      pathData,
      color: colors[index % colors.length],
      pool,
      index
    };
  });

  return (
    <div className="space-y-4">
      {/* Pie Chart */}
      <div className="flex items-center justify-center">
        <svg width="240" height="240" className="overflow-visible">
          {segments.map((segment, index) => (
            <g key={segment.pool.poolId}>
              <path
                d={segment.pathData}
                fill={segment.color}
                stroke="hsl(var(--card))"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity cursor-pointer"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
              >
                <title>{segment.pool.pairedToken}: {segment.pool.percentage.toFixed(1)}%</title>
              </path>
            </g>
          ))}
          
        </svg>
      </div>

      {/* Analysis Insights */}
      <div className="space-y-3 mt-6">
        {/* Dominant Pool Warning */}
        {(() => {
          const dominantPool = data[0];
          const isDominant = dominantPool && dominantPool.percentage > 60;
          return isDominant && (
            <div className="flex items-start gap-3 p-3 border border-amber-500/30 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-amber-400">Liquidity Concentration Risk</div>
                <div className="text-amber-300">
                  {dominantPool.percentage.toFixed(1)}% of liquidity is in the {dominantPool.pairedToken} pool. 
                  Consider diversification across multiple pools.
                </div>
              </div>
            </div>
          );
        })()}

        {/* Low Liquidity Warning */}
        {(() => {
          const totalLiquidity = data.reduce((sum, p) => sum + p.liquidityUsd, 0);
          return totalLiquidity < 10000 && (
            <div className="flex items-start gap-3 p-3 border border-rose-500/30 bg-rose-500/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-rose-400">Low Liquidity</div>
                <div className="text-rose-300">
                  Total liquidity below $10K may result in high slippage for larger trades.
                </div>
              </div>
            </div>
          );
        })()}

        {/* Good Diversification */}
        {(() => {
          const dominantPool = data[0];
          const isDominant = dominantPool && dominantPool.percentage > 60;
          return data.length >= 3 && !isDominant && (
            <div className="flex items-start gap-3 p-3 border border-emerald-500/30 bg-emerald-500/10 rounded-lg">
              <Target className="h-4 w-4 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-emerald-400">Well Diversified</div>
                <div className="text-emerald-300">
                  Good liquidity distribution across {data.length} pools provides multiple trading options.
                </div>
              </div>
            </div>
          );
        })()}

        {/* Trading Recommendations */}
        <div className="text-sm text-muted-foreground">
          <div className="font-medium mb-2">Trading Recommendations:</div>
          <ul className="space-y-1 text-xs">
            <li>• Best liquidity: {data[0]?.pairedToken} pool ({formatLiquidity(data[0]?.liquidityUsd || 0)})</li>
            <li>• Lowest risk: {data.filter(p => p.riskLevel === 'low')[0]?.pairedToken || 'None available'}</li>
            <li>• For large trades: Consider splitting across multiple pools</li>
          </ul>
        </div>
      </div>
    </div>
  );
};


export default function LiquidityAnalysis({ 
  tokenSymbol, 
  pools, 
  tokenNode, 
  totalLiquidity,
  allTokenNodes,
  allTokens 
}: LiquidityAnalysisProps) {
  // Process pool data for analysis using atomic liquidity (consistent with new architecture)
  const poolData: PoolLiquidityData[] = React.useMemo(() => {
    // Use atomic liquidity values that are now calculated in price-graph
    const poolsWithAtomicLiquidity = pools.map(pool => {
      // Use the atomic liquidity from liquidityRelative or liquidityUsd
      const atomicLiquidity = pool.liquidityRelative || pool.liquidityUsd || 0;
      
      return { ...pool, atomicLiquidity };
    });
    
    const totalPoolLiquidity = poolsWithAtomicLiquidity.reduce((sum, pool) => sum + pool.atomicLiquidity, 0);
    
    return poolsWithAtomicLiquidity
      .map(pool => {
        const liquidityUsd = pool.atomicLiquidity;
        const percentage = totalPoolLiquidity > 0 ? (liquidityUsd / totalPoolLiquidity) * 100 : 0;
        
        // Determine paired token
        const pairedTokenId = pool.tokenA === tokenNode?.contractId ? pool.tokenB : pool.tokenA;
        const pairedToken = getTokenSymbol(pairedTokenId, allTokens);
        
        // Calculate risk level using atomic liquidity
        const dataAge = Date.now() - pool.lastUpdated;
        const ageHours = dataAge / (1000 * 60 * 60);
        const liquidityScore = Math.min(1, liquidityUsd / 100000000000000); // Using atomic value threshold
        
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (liquidityScore < 0.3 || ageHours > 24) {
          riskLevel = 'high';
        } else if (liquidityScore < 0.6 || ageHours > 12) {
          riskLevel = 'medium';
        }
        
        return {
          poolId: pool.poolId,
          liquidityUsd,
          percentage,
          pairedToken,
          riskLevel
        };
      })
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  }, [pools, tokenNode, allTokenNodes]);


  if (pools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Liquidity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-muted" />
            <p className="font-semibold">No Liquidity Data</p>
            <p className="text-sm">No pools available for analysis.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Liquidity Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Liquidity Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {tokenSymbol} liquidity across {pools.length} pools
          </p>
        </CardHeader>
        <CardContent>
          <LiquidityDistributionChart data={poolData} />
        </CardContent>
      </Card>


    </div>
  );
}