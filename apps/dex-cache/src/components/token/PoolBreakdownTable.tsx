'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Activity,
  AlertCircle,
  Info,
  Plus
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PoolEdge } from '@/lib/pricing/price-graph';
import {
  formatTokenReserve,
  calculateDecimalAwareUIExchangeRate,
  formatNumber,
  getTokenDecimalsFromMeta,
  type TokenMeta as UITokenMeta
} from '@/lib/ui-decimal-utils';
import { useTokenColors } from '@/hooks/useTokenColors';

// Use the TokenMeta from ui-decimal-utils
type TokenMeta = UITokenMeta;

interface PoolBreakdownTableProps {
  tokenId: string;
  tokenSymbol: string;
  pools: PoolEdge[];
  allTokens: TokenMeta[];
  tokenPrices?: Map<string, { usdPrice: number; }>; // Optional token prices for USD conversion
}

interface EnhancedPoolData {
  pool: PoolEdge;
  pairedToken: TokenMeta | null;
  tokenReserve: number;
  pairedReserve: number;
  exchangeRate: number;
  liquidityScore: number;
  liquidityUsd?: number; // Calculated USD liquidity when prices available
  riskLevel: 'low' | 'medium' | 'high';
}

type SortField = 'liquidity' | 'tokenReserve' | 'rate' | 'updated';
type SortDirection = 'asc' | 'desc';

// formatNumber and formatPercentage are now imported from ui-decimal-utils

const getTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getLiquidityColor = (score: number): string => {
  if (score >= 0.8) return 'text-emerald-400';
  if (score >= 0.5) return 'text-amber-400';
  return 'text-rose-400';
};

const getRiskBadgeColor = (risk: string): string => {
  switch (risk) {
    case 'low': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    case 'medium': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
    case 'high': return 'border-rose-500/30 text-rose-400 bg-rose-500/10';
    default: return 'border-border text-muted-foreground';
  }
};

export default function PoolBreakdownTable({
  tokenId,
  tokenSymbol,
  pools,
  allTokens,
  tokenPrices
}: PoolBreakdownTableProps) {
  const [sortField, setSortField] = useState<SortField>('liquidity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Get current token metadata
  const currentToken = allTokens.find(t => t.contractId === tokenId);

  // Extract all unique tokens for color extraction (current token + all paired tokens)
  const uniqueTokensForColors = React.useMemo(() => {
    const tokenSet = new Set<string>();
    const tokens: Array<{ contractId: string; image?: string }> = [];

    // Add current token
    if (currentToken) {
      tokenSet.add(currentToken.contractId);
      tokens.push({
        contractId: currentToken.contractId,
        image: currentToken.image
      });
    }

    // Add all paired tokens
    pools.forEach(pool => {
      const pairedTokenId = pool.tokenA === tokenId ? pool.tokenB : pool.tokenA;
      if (!tokenSet.has(pairedTokenId)) {
        tokenSet.add(pairedTokenId);
        const pairedToken = allTokens.find(t => t.contractId === pairedTokenId);
        if (pairedToken) {
          tokens.push({
            contractId: pairedToken.contractId,
            image: pairedToken.image
          });
        }
      }
    });

    return tokens;
  }, [pools, allTokens, tokenId, currentToken]);

  // Extract colors for all tokens
  const { getTokenColor } = useTokenColors(uniqueTokensForColors);

  // Helper function to calculate USD liquidity if prices are available
  const calculateUsdLiquidity = (
    tokenReserve: number,
    pairedReserve: number,
    tokenId: string,
    pairedTokenId: string
  ): number | undefined => {
    if (!tokenPrices) return undefined;

    const tokenPrice = tokenPrices.get(tokenId);
    const pairedPrice = tokenPrices.get(pairedTokenId);

    if (!tokenPrice || !pairedPrice) return undefined;

    const tokenValue = tokenReserve * tokenPrice.usdPrice;
    const pairedValue = pairedReserve * pairedPrice.usdPrice;

    // Return the total pool value (both sides)
    return tokenValue + pairedValue;
  };

  // Helper function to format USD liquidity for display
  const formatUsdLiquidity = (usdValue: number): string => {
    if (usdValue === 0) {
      return 'N/A';
    }
    
    // Format USD values with appropriate abbreviations
    if (usdValue >= 1e9) {
      return `$${(usdValue / 1e9).toFixed(2)}B`;
    } else if (usdValue >= 1e6) {
      return `$${(usdValue / 1e6).toFixed(2)}M`;
    } else if (usdValue >= 1e3) {
      return `$${(usdValue / 1e3).toFixed(1)}K`;
    } else if (usdValue >= 1) {
      return `$${usdValue.toFixed(2)}`;
    } else if (usdValue >= 0.01) {
      return `$${usdValue.toFixed(4)}`;
    } else {
      return `$${usdValue.toExponential(2)}`;
    }
  };

  // Process pools data with duplicate detection
  const enhancedPools: EnhancedPoolData[] = React.useMemo(() => {
    // Check for duplicate trading pairs
    const pairCounts = new Map<string, number>();
    pools.forEach(pool => {
      const isTokenA = pool.tokenA === tokenId;
      const pairedTokenId = isTokenA ? pool.tokenB : pool.tokenA;
      const pairedToken = allTokens.find(t => t.contractId === pairedTokenId);
      const pairKey = `${tokenId}/${pairedTokenId}`;
      pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);

      if (pairCounts.get(pairKey)! > 1) {
        console.warn(`[PoolBreakdown] ⚠️  DUPLICATE PAIR DETECTED: ${pairedToken?.symbol || '?'} appears ${pairCounts.get(pairKey)} times`);
        console.warn(`[PoolBreakdown]   Pool ID: ${pool.poolId}, TokenA: ${pool.tokenA}, TokenB: ${pool.tokenB}`);
      }
    });

    return pools.map(pool => {
      const isTokenA = pool.tokenA === tokenId;
      const pairedTokenId = isTokenA ? pool.tokenB : pool.tokenA;
      const pairedToken = allTokens.find(t => t.contractId === pairedTokenId) || null;

      // Get raw atomic reserves
      const tokenReserveAtomic = isTokenA ? pool.reserveA : pool.reserveB;
      const pairedReserveAtomic = isTokenA ? pool.reserveB : pool.reserveA;

      // Get token decimals
      const tokenDecimals = getTokenDecimalsFromMeta(tokenId, allTokens);
      const pairedDecimals = getTokenDecimalsFromMeta(pairedTokenId, allTokens);

      // Convert to decimal format for calculations
      const tokenReserve = formatTokenReserve(tokenReserveAtomic, tokenDecimals);
      const pairedReserve = formatTokenReserve(pairedReserveAtomic, pairedDecimals);

      // Use USD-based liquidity metrics from iterative price discovery
      // liquidityRelative is a percentage (0-100) calculated from USD liquidity in price-graph

      const exchangeRate = calculateDecimalAwareUIExchangeRate(
        tokenReserveAtomic, tokenDecimals,
        pairedReserveAtomic, pairedDecimals
      );

      // Calculate USD liquidity if prices are available
      const liquidityUsd = calculateUsdLiquidity(
        tokenReserve,
        pairedReserve,
        tokenId,
        pairedTokenId
      );

      // Use the relative liquidity score from USD-based calculations in price-graph
      // liquidityRelative is already a percentage (0-100) calculated from USD liquidity
      const liquidityScore = (pool.liquidityRelative !== undefined && pool.liquidityRelative !== null)
        ? pool.liquidityRelative / 100  // Convert percentage to 0-1 scale for display
        : 0; // No fallback needed - either discovered via USD or 0

      // Enhanced debug logging for liquidity scores
      if (pool.liquidityRelative !== undefined && pool.liquidityRelative !== null) {
        // Get paired token info for better logging
        const pairedTokenSymbol = pairedToken?.symbol || 'Unknown';
        const tokenSymbol = allTokens.find(t => t.contractId === tokenId)?.symbol || 'Unknown';

        console.log(`[PoolBreakdown] 🔍 Pool ${pool.poolId} (${tokenSymbol}/${pairedTokenSymbol}):`);
        console.log(`[PoolBreakdown]   liquidityRelative=${pool.liquidityRelative}% -> liquidityScore=${liquidityScore}`);
        console.log(`[PoolBreakdown]   USD liquidity=${liquidityUsd?.toFixed(2) || 'N/A'}`);
        console.log(`[PoolBreakdown]   Atomic liquidity=${pool.liquidityUsd?.toFixed(2) || 'N/A'}`);
        console.log(`[PoolBreakdown]   Raw reserves: ${tokenReserve.toFixed(6)} ${tokenSymbol}, ${pairedReserve.toFixed(6)} ${pairedTokenSymbol}`);
        // Risk level will be calculated below

        // Flag unusual values
        if (pool.liquidityRelative < 0.1 && liquidityUsd && liquidityUsd > 100000) {
          console.warn(`[PoolBreakdown] ⚠️  ANOMALY: High USD liquidity ($${liquidityUsd.toFixed(0)}) but very low relative score (${pool.liquidityRelative.toFixed(3)}%)`);
        }

        if (liquidityScore < 0.01 && liquidityUsd && liquidityUsd > 1000000) {
          console.warn(`[PoolBreakdown] ⚠️  MAJOR ANOMALY: Million+ USD liquidity but <1% score - suggests global max issue`);
        }
      }

      // Calculate risk level based on USD liquidity and age
      const dataAge = Date.now() - pool.lastUpdated;
      const ageHours = dataAge / (1000 * 60 * 60);

      let riskLevel: 'low' | 'medium' | 'high' = 'low';

      const usdLiquidity = pool.liquidityUsd || 0;
      
      // USD-based risk assessment (no fallbacks needed)
      if (usdLiquidity === 0 || usdLiquidity < 1000 || ageHours > 72) {
        // No USD data, very low liquidity, or very stale data
        riskLevel = 'high';
      } else if (usdLiquidity < 10000 || ageHours > 48) {
        // Low liquidity or stale data
        riskLevel = 'medium';
      }

      console.log(`[PoolBreakdown]   Risk calculation: USD=${usdLiquidity.toFixed(0)}, score=${liquidityScore.toFixed(4)}, age=${ageHours.toFixed(1)}h -> ${riskLevel}`);

      return {
        pool,
        pairedToken,
        tokenReserve,
        pairedReserve,
        exchangeRate,
        liquidityScore,
        liquidityUsd,
        riskLevel
      };
    });
  }, [pools, allTokens, tokenId, tokenPrices]);


  // Sort pools
  const sortedPools = React.useMemo(() => {
    return [...enhancedPools].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case 'liquidity':
          compareValue = (a.pool.liquidityUsd || 0) - (b.pool.liquidityUsd || 0);
          break;
        case 'tokenReserve':
          compareValue = a.tokenReserve - b.tokenReserve;
          break;
        case 'rate':
          compareValue = a.exchangeRate - b.exchangeRate;
          break;
        case 'updated':
          compareValue = a.pool.lastUpdated - b.pool.lastUpdated;
          break;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
  }, [enhancedPools, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="p-4 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors text-left"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ?
            <ArrowUp className="w-3 h-3" /> :
            <ArrowDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  if (pools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Pool Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p className="text-lg font-semibold">No Active Pools</p>
            <p className="text-sm mt-1">{tokenSymbol} is not currently traded in any pools.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Pool Breakdown
          <Badge variant="secondary" className="ml-2">
            {pools.length} pools
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {tokenSymbol} liquidity and trading pairs across all active pools
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-foreground">
            <thead className="bg-muted/50 text-left text-xs tracking-wider">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">Trading Pair</th>
                <SortHeader field="tokenReserve">{tokenSymbol} Reserve</SortHeader>
                <SortHeader field="liquidity">
                  <div className="flex items-center gap-1">
                    USD Liquidity
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-md p-3">
                          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                            <p>Pool liquidity in USD calculated using iterative price discovery from sBTC oracle. Represents the geometric mean of both token sides valued in USD (√(tokenA_USD × tokenB_USD)).</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </SortHeader>
                <th className="p-4 font-semibold text-muted-foreground">
                  <div className="flex items-center gap-1">
                    Liquidity Score
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-md p-3">
                          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                            <p>Relative score (0-100%) comparing this pool's USD liquidity to the highest liquidity pool globally. Based on iterative price discovery from sBTC oracle anchor.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </th>
                <SortHeader field="rate">Exchange Rate</SortHeader>
                <th className="p-4 font-semibold text-muted-foreground">Risk</th>
                <SortHeader field="updated">Last Updated</SortHeader>
                <th className="p-4 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedPools.map((item, index) => (
                <tr key={item.pool.poolId} className="hover:bg-muted/10 transition-colors">
                  {/* Trading Pair */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {/* Current Token Image */}
                        <Link href={`/prices/${encodeURIComponent(tokenId)}`} className="group">
                          <div className="w-6 h-6 rounded-full bg-primary/10 border border-border flex items-center justify-center overflow-hidden hover:border-primary/50 hover:bg-primary/20 transition-colors cursor-pointer group-hover:scale-110 transform duration-200">
                            {currentToken?.image ? (
                              <Image
                                src={currentToken.image}
                                alt={`${tokenSymbol} logo`}
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold text-primary">
                                {tokenSymbol.slice(0, 1)}
                              </span>
                            )}
                          </div>
                        </Link>
                        <span>/</span>
                        {/* Paired Token Image */}
                        <Link href={`/prices/${encodeURIComponent(item.pairedToken?.contractId || '')}`} className="group">
                          <div className="w-6 h-6 rounded-full bg-secondary/10 border border-border flex items-center justify-center overflow-hidden hover:border-secondary/50 hover:bg-secondary/20 transition-colors cursor-pointer group-hover:scale-110 transform duration-200">
                            {item.pairedToken?.image ? (
                              <Image
                                src={item.pairedToken.image}
                                alt={`${item.pairedToken.symbol} logo`}
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold text-secondary">
                                {item.pairedToken?.symbol.slice(0, 1) || '?'}
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                      <div>
                        <div className="font-semibold">
                          {tokenSymbol}/{item.pairedToken?.symbol || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.pairedToken?.name || 'Unknown Token'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Token Reserve */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="text-lg font-bold">
                      {formatNumber(item.tokenReserve)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tokenSymbol} tokens
                    </div>
                  </td>

                  {/* USD Liquidity */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span className="font-semibold">
                        {formatUsdLiquidity(item.pool.liquidityUsd || 0)}
                      </span>
                    </div>
                  </td>

                  {/* Liquidity Score */}
                  <td className="p-4 whitespace-nowrap">
                    <div className={cn("text-lg font-semibold", getLiquidityColor(item.liquidityScore))}>
                      {(item.liquidityScore * 100).toFixed(3)}%
                    </div>
                  </td>

                  {/* Exchange Rate */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="font-semibold">
                      {formatNumber(item.exchangeRate)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tokenSymbol}/{item.pairedToken?.symbol || '?'}
                    </div>
                  </td>

                  {/* Risk Level */}
                  <td className="p-4 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getRiskBadgeColor(item.riskLevel))}
                    >
                      {item.riskLevel}
                    </Badge>
                  </td>

                  {/* Last Updated */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="text-sm">
                      {getTimeAgo(item.pool.lastUpdated)}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="gap-2" asChild>
                        <a href={`/pools?tokenA=${encodeURIComponent(tokenId)}&tokenB=${encodeURIComponent(item.pairedToken?.contractId || '')}&pool=${encodeURIComponent(item.pool.poolId)}#add`}>
                          <Plus className="h-4 w-4" />
                          Add
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="border-t border-border p-4 bg-muted/20">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total Pools:</span>
              <span className="font-semibold">{pools.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total {tokenSymbol} Liquidity:</span>
              <span className="font-semibold">
                {formatNumber(sortedPools.reduce((sum, p) => sum + p.tokenReserve, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total USD Liquidity:</span>
              <span className="font-semibold">
                {formatUsdLiquidity(sortedPools.reduce((sum, p) => sum + (p.pool.liquidityUsd || 0), 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Avg Risk:</span>
              <span className="font-semibold">
                {sortedPools.filter(p => p.riskLevel === 'low').length > sortedPools.length / 2 ? 'Low' :
                  sortedPools.filter(p => p.riskLevel === 'high').length > sortedPools.length / 2 ? 'High' : 'Medium'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}