'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Bitcoin, 
  TrendingUp, 
  Activity, 
  Clock, 
  Network,
  ExternalLink,
  Copy,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import {
  formatTokenReserve,
  formatNumber
} from '@/lib/ui-decimal-utils';

interface TokenPriceDetailProps {
  tokenData: {
    tokenId: string;
    symbol: string;
    name: string;
    decimals: number;
    image?: string;
    description?: string;
    usdPrice: number;
    sbtcRatio: number;
    confidence: number;
    lastUpdated: number;
    calculationDetails?: {
      btcPrice: number;
      pathsUsed: number;
      totalLiquidity: number;
      priceVariation: number;
    };
    primaryPath?: {
      tokens: string[];
      pools: Array<{
        poolId: string;
        tokenA: string;
        tokenB: string;
        reserveA: number;
        reserveB: number;
        fee: number;
        lastUpdated: number;
      }>;
      totalLiquidity: number;
      reliability: number;
      confidence: number;
      pathLength: number;
    };
    alternativePaths?: Array<{
      tokens: string[];
      poolCount: number;
      totalLiquidity: number;
      reliability: number;
      confidence: number;
      pathLength: number;
    }>;
  };
}

export default function TokenPriceDetail({ tokenData }: TokenPriceDetailProps) {
  const [copied, setCopied] = React.useState(false);

  const copyTokenId = async () => {
    try {
      await navigator.clipboard.writeText(tokenData.tokenId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined || isNaN(price)) {
      return '$—';
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

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600 border-green-500/20 bg-green-500/10';
    if (confidence >= 0.6) return 'text-yellow-600 border-yellow-500/20 bg-yellow-500/10';
    return 'text-red-600 border-red-500/20 bg-red-500/10';
  };

  return (
    <main className="flex-1 container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/prices">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Prices
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-border flex items-center justify-center">
            <span className="text-lg font-bold text-primary">
              {tokenData.symbol.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tokenData.symbol}</h1>
            <p className="text-muted-foreground">{tokenData.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Price Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Current Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {formatPrice(tokenData.usdPrice)}
                  </div>
                  <div className="text-sm text-muted-foreground">USD Price</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xl font-semibold text-muted-foreground mb-2">
                    <Bitcoin className="h-5 w-5" />
                    {tokenData.sbtcRatio.toFixed(8)}
                  </div>
                  <div className="text-sm text-muted-foreground">sBTC Ratio</div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <Badge variant="outline" className={getConfidenceColor(tokenData.confidence)}>
                  {(tokenData.confidence * 100).toFixed(0)}% Confidence
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Updated {new Date(tokenData.lastUpdated).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Primary Path */}
          {tokenData.primaryPath && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  Primary Price Discovery Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Path Visualization */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm font-medium text-foreground mb-2">Trading Path</div>
                    <div className="flex items-center gap-2 text-sm font-mono">
                      {tokenData.primaryPath.tokens.map((token, index) => (
                        <React.Fragment key={index}>
                          <span className="px-2 py-1 bg-primary/10 rounded text-primary">
                            {token.split('.')[1] || token}
                          </span>
                          {index < tokenData.primaryPath!.tokens.length - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Path Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-lg font-semibold">{tokenData.primaryPath.pathLength - 1}</div>
                      <div className="text-xs text-muted-foreground">Hops</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        ${formatNumber(tokenData.primaryPath.totalLiquidity)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Liquidity</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {(tokenData.primaryPath.reliability * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Reliability</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {(tokenData.primaryPath.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Path Confidence</div>
                    </div>
                  </div>

                  {/* Pool Details */}
                  {tokenData.primaryPath.pools && tokenData.primaryPath.pools.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">Pool Details</div>
                      <div className="space-y-2">
                        {tokenData.primaryPath.pools.map((pool, index) => (
                          <div key={pool.poolId} className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">
                                Pool {index + 1}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(pool.fee * 100).toFixed(2)}% fee
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Reserves: {formatNumber(formatTokenReserve(pool.reserveA, tokenData.decimals || 6))} / {formatNumber(formatTokenReserve(pool.reserveB, 8))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alternative Paths */}
          {tokenData.alternativePaths && tokenData.alternativePaths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Alternative Paths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tokenData.alternativePaths.slice(0, 5).map((path, index) => (
                    <div key={index} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">
                          Path {index + 2}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {path.pathLength - 1} hops
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {(path.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {path.tokens.map(token => token.split('.')[1] || token).join(' → ')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Liquidity: ${formatNumber(path.totalLiquidity)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Token Info */}
          <Card>
            <CardHeader>
              <CardTitle>Token Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-foreground">Contract ID</div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                    {tokenData.tokenId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyTokenId}
                    className="p-1"
                  >
                    {copied ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-foreground">Decimals</div>
                <div className="text-sm text-muted-foreground mt-1">{tokenData.decimals}</div>
              </div>

              {tokenData.description && (
                <div>
                  <div className="text-sm font-medium text-foreground">Description</div>
                  <div className="text-sm text-muted-foreground mt-1">{tokenData.description}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calculation Details */}
          {tokenData.calculationDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Calculation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">BTC Price</span>
                  <span className="text-sm font-medium">
                    ${tokenData.calculationDetails.btcPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Paths Analyzed</span>
                  <span className="text-sm font-medium">{tokenData.calculationDetails.pathsUsed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Liquidity</span>
                  <span className="text-sm font-medium">
                    ${tokenData.calculationDetails.totalLiquidity.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Price Variation</span>
                  <span className="text-sm font-medium">
                    {(tokenData.calculationDetails.priceVariation * 100).toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" asChild>
                <a
                  href={`https://explorer.stacks.co/txid/${tokenData.tokenId}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Explorer
                </a>
              </Button>
              
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/pools?search=${tokenData.symbol}`}>
                  View Liquidity Pools
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}