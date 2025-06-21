'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowUp, 
  ArrowDown, 
  ExternalLink, 
  Activity,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Zap
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { PoolEdge } from '@/lib/pricing/price-graph';
import {
  formatTokenReserve,
  calculateTokenSharePercentage,
  calculateDecimalAwareUIExchangeRate,
  formatNumber,
  formatPercentage,
  getTokenDecimalsFromMeta,
  type TokenMeta as UITokenMeta
} from '@/lib/ui-decimal-utils';

// Use the TokenMeta from ui-decimal-utils
type TokenMeta = UITokenMeta;

interface PoolBreakdownTableProps {
  tokenId: string;
  tokenSymbol: string;
  pools: PoolEdge[];
  allTokens: TokenMeta[];
}

interface EnhancedPoolData {
  pool: PoolEdge;
  pairedToken: TokenMeta | null;
  tokenReserve: number;
  pairedReserve: number;
  tokenShare: number;
  exchangeRate: number;
  liquidityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

type SortField = 'liquidity' | 'tokenReserve' | 'share' | 'rate' | 'updated';
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
  allTokens 
}: PoolBreakdownTableProps) {
  const [sortField, setSortField] = useState<SortField>('liquidity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Get current token metadata
  const currentToken = allTokens.find(t => t.contractId === tokenId);

  // Process pools data
  const enhancedPools: EnhancedPoolData[] = React.useMemo(() => {
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
      
      // Calculate decimal-aware metrics
      const totalLiquidity = pool.liquidityUsd || Math.sqrt(tokenReserve * pairedReserve);
      const tokenShare = calculateTokenSharePercentage(
        tokenReserveAtomic, tokenDecimals,
        pairedReserveAtomic, pairedDecimals
      );
      
      const exchangeRate = calculateDecimalAwareUIExchangeRate(
        tokenReserveAtomic, tokenDecimals,
        pairedReserveAtomic, pairedDecimals
      );
      
      // Calculate liquidity score (0-1)
      const liquidityScore = Math.min(1, totalLiquidity / 100000); // Normalize to $100k max
      
      // Calculate risk level based on liquidity and age
      const dataAge = Date.now() - pool.lastUpdated;
      const ageHours = dataAge / (1000 * 60 * 60);
      
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (liquidityScore < 0.3 || ageHours > 24) {
        riskLevel = 'high';
      } else if (liquidityScore < 0.6 || ageHours > 12) {
        riskLevel = 'medium';
      }
      
      return {
        pool,
        pairedToken,
        tokenReserve,
        pairedReserve,
        tokenShare,
        exchangeRate,
        liquidityScore,
        riskLevel
      };
    });
  }, [pools, allTokens, tokenId]);

  // Sort pools
  const sortedPools = React.useMemo(() => {
    return [...enhancedPools].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortField) {
        case 'liquidity':
          compareValue = a.pool.liquidityUsd - b.pool.liquidityUsd;
          break;
        case 'tokenReserve':
          compareValue = a.tokenReserve - b.tokenReserve;
          break;
        case 'share':
          compareValue = a.tokenShare - b.tokenShare;
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
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">Trading Pair</th>
                <SortHeader field="tokenReserve">{tokenSymbol} Reserve</SortHeader>
                <SortHeader field="liquidity">Pool Liquidity</SortHeader>
                <SortHeader field="share">Token Share</SortHeader>
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
                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-border flex items-center justify-center overflow-hidden">
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
                        <span>/</span>
                        {/* Paired Token Image */}
                        <div className="w-6 h-6 rounded-full bg-secondary/10 border border-border flex items-center justify-center overflow-hidden">
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

                  {/* Pool Liquidity */}
                  <td className="p-4 whitespace-nowrap relative">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="font-semibold">
                        {formatNumber(item.pool.liquidityUsd)}
                      </span>
                    </div>
                    <div className={cn("text-xs", getLiquidityColor(item.liquidityScore))}>
                      Score: {(item.liquidityScore * 100).toFixed(0)}%
                    </div>
                    
                    {/* Coming Soon Overlay */}
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs font-medium text-muted-foreground">
                          Coming Soon
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Token Share */}
                  <td className="p-4 whitespace-nowrap relative">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-muted rounded-full h-2">
                        <div 
                          className="h-2 bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, item.tokenShare)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {formatPercentage(item.tokenShare)}
                      </span>
                    </div>
                    
                    {/* Coming Soon Overlay */}
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs font-medium text-muted-foreground">
                          Coming Soon
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Exchange Rate */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="font-semibold">
                      {item.exchangeRate.toFixed(6)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tokenSymbol}/{item.pairedToken?.symbol || '?'}
                    </div>
                  </td>

                  {/* Risk Level */}
                  <td className="p-4 whitespace-nowrap relative">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getRiskBadgeColor(item.riskLevel))}
                    >
                      {item.riskLevel}
                    </Badge>
                    
                    {/* Coming Soon Overlay */}
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs font-medium text-muted-foreground">
                          Coming Soon
                        </div>
                      </div>
                    </div>
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
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Zap className="h-4 w-4" />
                        Trade
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
                ${formatNumber(sortedPools.reduce((sum, p) => sum + (p.pool.liquidityUsd || 0), 0))}
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