'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart2, 
  PieChart,
  TrendingUp,
  AlertTriangle,
  Droplets,
  Target,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoolEdge } from '@/lib/pricing/price-graph';
import { TokenNode } from '@/lib/pricing/price-graph';
import {
  calculateDecimalAwareLiquidity,
  getTokenDecimals,
  convertAtomicToDecimal
} from '@/lib/pricing/decimal-utils';

interface LiquidityAnalysisProps {
  tokenSymbol: string;
  pools: PoolEdge[];
  tokenNode: TokenNode | null;
  totalLiquidity: number;
  allTokenNodes: TokenNode[]; // Added to get decimal information
}

interface PoolLiquidityData {
  poolId: string;
  liquidityUsd: number;
  percentage: number;
  pairedToken: string;
  riskLevel: 'low' | 'medium' | 'high';
}

const formatLiquidity = (liquidity: number): string => {
  if (liquidity >= 1000000) {
    return `$${(liquidity / 1000000).toFixed(2)}M`;
  } else if (liquidity >= 1000) {
    return `$${(liquidity / 1000).toFixed(1)}K`;
  }
  return `$${liquidity.toFixed(0)}`;
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'low': return 'text-emerald-500 bg-emerald-500/20';
    case 'medium': return 'text-amber-500 bg-amber-500/20';
    case 'high': return 'text-rose-500 bg-rose-500/20';
    default: return 'text-muted-foreground bg-muted/20';
  }
};

const getTokenSymbol = (tokenId: string): string => {
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
    'bg-blue-500',
    'bg-emerald-500', 
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-red-500'
  ];

  return (
    <div className="space-y-3">
      {data.map((pool, index) => (
        <div key={pool.poolId} className="flex items-center gap-3">
          <div 
            className={cn("w-3 h-3 rounded-full", colors[index % colors.length])}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{pool.pairedToken}</span>
              <span className="text-sm text-muted-foreground">
                {pool.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className={cn("h-2 rounded-full", colors[index % colors.length])}
                style={{ width: `${pool.percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {formatLiquidity(pool.liquidityUsd)}
              </span>
              <Badge 
                variant="outline" 
                className={cn("text-xs", getRiskColor(pool.riskLevel))}
              >
                {pool.riskLevel}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const MetricCard = ({ 
  icon: Icon, 
  title, 
  value, 
  description, 
  colorScheme = 'default' 
}: {
  icon: React.ComponentType<any>;
  title: string;
  value: string;
  description: string;
  colorScheme?: 'default' | 'success' | 'warning' | 'danger';
}) => {
  const colors = {
    default: 'text-primary bg-primary/10',
    success: 'text-emerald-500 bg-emerald-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    danger: 'text-rose-500 bg-rose-500/10'
  };

  return (
    <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
      <div className={cn("p-2 rounded-lg", colors[colorScheme])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="font-semibold">{value}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      </div>
    </div>
  );
};

export default function LiquidityAnalysis({ 
  tokenSymbol, 
  pools, 
  tokenNode, 
  totalLiquidity,
  allTokenNodes 
}: LiquidityAnalysisProps) {
  // Process pool data for analysis with decimal-aware calculations
  const poolData: PoolLiquidityData[] = React.useMemo(() => {
    // Calculate decimal-aware liquidity for each pool
    const poolsWithDecimalLiquidity = pools.map(pool => {
      // Get token nodes for decimal information
      const tokenANode = allTokenNodes.find(t => t.contractId === pool.tokenA);
      const tokenBNode = allTokenNodes.find(t => t.contractId === pool.tokenB);
      
      if (!tokenANode || !tokenBNode) {
        console.warn(`[LiquidityAnalysis] Missing token nodes for pool ${pool.poolId}`);
        return { ...pool, decimalAwareLiquidity: 0 };
      }
      
      // Calculate decimal-aware geometric mean
      const decimalAwareLiquidity = calculateDecimalAwareLiquidity(
        pool.reserveA, tokenANode.decimals,
        pool.reserveB, tokenBNode.decimals
      );
      
      return { ...pool, decimalAwareLiquidity };
    });
    
    const totalPoolLiquidity = poolsWithDecimalLiquidity.reduce((sum, pool) => sum + pool.decimalAwareLiquidity, 0);
    
    return poolsWithDecimalLiquidity
      .map(pool => {
        const liquidityUsd = pool.decimalAwareLiquidity;
        const percentage = totalPoolLiquidity > 0 ? (liquidityUsd / totalPoolLiquidity) * 100 : 0;
        
        // Determine paired token
        const pairedTokenId = pool.tokenA === tokenNode?.contractId ? pool.tokenB : pool.tokenA;
        const pairedToken = getTokenSymbol(pairedTokenId);
        
        // Calculate risk level using decimal-aware liquidity
        const dataAge = Date.now() - pool.lastUpdated;
        const ageHours = dataAge / (1000 * 60 * 60);
        const liquidityScore = Math.min(1, liquidityUsd / 100000); // Using decimal-aware value
        
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

  // Calculate analysis metrics
  const analysisMetrics = React.useMemo(() => {
    const totalPoolLiquidity = poolData.reduce((sum, p) => sum + p.liquidityUsd, 0);
    const avgLiquidity = poolData.length > 0 ? totalPoolLiquidity / poolData.length : 0;
    
    const diversificationScore = poolData.length >= 3 ? 'Good' : poolData.length >= 2 ? 'Fair' : 'Poor';
    const riskDistribution = {
      low: poolData.filter(p => p.riskLevel === 'low').length,
      medium: poolData.filter(p => p.riskLevel === 'medium').length,
      high: poolData.filter(p => p.riskLevel === 'high').length
    };
    
    const dominantPool = poolData[0];
    const isDominant = dominantPool && dominantPool.percentage > 60;
    
    return {
      totalPoolLiquidity,
      avgLiquidity,
      diversificationScore,
      riskDistribution,
      isDominant,
      dominantPool
    };
  }, [poolData]);

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
      <Card className="relative">
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
        
        {/* Coming Soon Overlay */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="text-center p-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <PieChart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Enhanced liquidity distribution analysis is being validated and will be available soon.
            </p>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetricCard
            icon={Droplets}
            title="Total Liquidity"
            value={formatLiquidity(analysisMetrics.totalPoolLiquidity)}
            description={`Across ${pools.length} active pools`}
            colorScheme="default"
          />
          
          <MetricCard
            icon={Target}
            title="Average Pool Size"
            value={formatLiquidity(analysisMetrics.avgLiquidity)}
            description="Mean liquidity per pool"
            colorScheme="default"
          />
          
          <MetricCard
            icon={Activity}
            title="Diversification"
            value={analysisMetrics.diversificationScore}
            description={`${pools.length} trading pairs available`}
            colorScheme={
              analysisMetrics.diversificationScore === 'Good' ? 'success' :
              analysisMetrics.diversificationScore === 'Fair' ? 'warning' : 'danger'
            }
          />
          
          <MetricCard
            icon={Zap}
            title="Risk Profile"
            value={`${analysisMetrics.riskDistribution.low}L/${analysisMetrics.riskDistribution.medium}M/${analysisMetrics.riskDistribution.high}H`}
            description="Low/Medium/High risk pools"
            colorScheme={
              analysisMetrics.riskDistribution.high > analysisMetrics.riskDistribution.low ? 'danger' :
              analysisMetrics.riskDistribution.medium > 0 ? 'warning' : 'success'
            }
          />
        </CardContent>
      </Card>

      {/* Analysis Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analysis Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Dominant Pool Warning */}
          {analysisMetrics.isDominant && analysisMetrics.dominantPool && (
            <div className="flex items-start gap-3 p-3 border border-amber-500/30 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-amber-400">Liquidity Concentration Risk</div>
                <div className="text-amber-300">
                  {analysisMetrics.dominantPool.percentage.toFixed(1)}% of liquidity is in the {analysisMetrics.dominantPool.pairedToken} pool. 
                  Consider diversification across multiple pools.
                </div>
              </div>
            </div>
          )}

          {/* Low Liquidity Warning */}
          {analysisMetrics.totalPoolLiquidity < 10000 && (
            <div className="flex items-start gap-3 p-3 border border-rose-500/30 bg-rose-500/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-rose-400">Low Liquidity</div>
                <div className="text-rose-300">
                  Total liquidity below $10K may result in high slippage for larger trades.
                </div>
              </div>
            </div>
          )}

          {/* Good Diversification */}
          {pools.length >= 3 && !analysisMetrics.isDominant && (
            <div className="flex items-start gap-3 p-3 border border-emerald-500/30 bg-emerald-500/10 rounded-lg">
              <Target className="h-4 w-4 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-emerald-400">Well Diversified</div>
                <div className="text-emerald-300">
                  Good liquidity distribution across {pools.length} pools provides multiple trading options.
                </div>
              </div>
            </div>
          )}

          {/* Trading Recommendations */}
          <div className="text-sm text-muted-foreground">
            <div className="font-medium mb-2">Trading Recommendations:</div>
            <ul className="space-y-1 text-xs">
              <li>• Best liquidity: {poolData[0]?.pairedToken} pool ({formatLiquidity(poolData[0]?.liquidityUsd || 0)})</li>
              <li>• Lowest risk: {poolData.filter(p => p.riskLevel === 'low')[0]?.pairedToken || 'None available'}</li>
              <li>• For large trades: Consider splitting across multiple pools</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}