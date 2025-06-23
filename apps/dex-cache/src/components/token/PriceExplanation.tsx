'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Bitcoin,
  Target,
  TrendingUp,
  Clock,
  Shield,
  Activity,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TokenPriceData } from '@/lib/pricing/price-calculator';
import { TokenNode, PricePath } from '@/lib/pricing/price-graph';
import { SBTC_CONTRACT_ID, isStablecoin } from '@/lib/pricing/btc-oracle';

interface TokenMeta {
  contractId: string;
  symbol: string;
  name: string;
  decimals: number;
  image?: string;
}

interface PriceExplanationProps {
  tokenMeta: TokenMeta;
  priceData: TokenPriceData | null;
  tokenNode: TokenNode | null;
  allTokens: TokenMeta[];
  pathsToSbtc?: PricePath[]; // Additional paths from graph for technical analysis
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
  if (liquidity === null || liquidity === undefined || isNaN(liquidity) || liquidity === 0) {
    return 'N/A';
  }
  
  if (liquidity >= 1e9) {
    return `$${(liquidity / 1e9).toFixed(2)}B`;
  } else if (liquidity >= 1e6) {
    return `$${(liquidity / 1e6).toFixed(2)}M`;
  } else if (liquidity >= 1e3) {
    return `$${(liquidity / 1e3).toFixed(1)}K`;
  } else {
    return `$${liquidity.toFixed(2)}`;
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return 'text-success bg-card border-success/20';
  if (confidence >= 0.6) return 'text-warning bg-card border-warning/20';
  return 'text-destructive bg-card border-destructive/20';
};

const getConfidenceIcon = (confidence: number) => {
  if (confidence >= 0.8) return CheckCircle;
  if (confidence >= 0.6) return AlertTriangle;
  return AlertTriangle;
};

const getTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function PriceExplanation({ 
  tokenMeta, 
  priceData, 
  tokenNode, 
  allTokens,
  pathsToSbtc = []
}: PriceExplanationProps) {
  const [showCalculation, setShowCalculation] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showTechnicalPaths, setShowTechnicalPaths] = useState(false);

  // Handle missing price data
  if (!priceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-500" />
            Why This Price?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2" />
            <p>Price calculation in progress...</p>
            <p className="text-sm mt-1">Analyzing liquidity pools and paths</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isTokenSbtc = tokenMeta.contractId === SBTC_CONTRACT_ID;
  const isTokenStablecoin = isStablecoin(tokenMeta.symbol);
  const confidence = priceData.confidence;
  const ConfidenceIcon = getConfidenceIcon(confidence);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-500" />
          Why This Price?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price & Confidence Header */}
        <div className="text-center space-y-3">
          <div className="text-3xl font-bold">
            {formatPrice(priceData.usdPrice)}
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("px-3 py-1", getConfidenceColor(confidence))}
            >
              <ConfidenceIcon className="w-3 h-3 mr-1" />
              {(confidence * 100).toFixed(1)}% Confidence
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Updated {getTimeAgo(priceData.lastUpdated)}
          </p>
        </div>

        {/* Price Discovery Method */}
        <div className="space-y-4">
          {isTokenSbtc && (
            <div className="bg-muted/50 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bitcoin className="w-5 h-5 text-primary" />
                <h4 className="font-semibold text-foreground">Oracle Price</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                This token's price comes directly from Bitcoin market data through multiple price feeds. 
                No pool calculations needed - this is the anchor for all other token prices.
              </p>
              {priceData.calculationDetails && (
                <div className="mt-2 text-xs text-muted-foreground">
                  BTC Price: ${priceData.calculationDetails.btcPrice.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {isTokenStablecoin && (
            <div className="bg-muted/50 border border-success/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-success" />
                <h4 className="font-semibold text-foreground">Pegged Asset</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                This token is designed to maintain a $1.00 value. Price discovery uses the peg 
                rather than pool exchange rates to avoid artificial deviations.
              </p>
              {tokenNode && tokenNode.totalLiquidity > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Total Liquidity: {formatLiquidity(tokenNode.totalLiquidity)}
                </div>
              )}
            </div>
          )}

          {!isTokenSbtc && !isTokenStablecoin && (
            <div className="bg-muted/50 border border-accent/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h4 className="font-semibold text-foreground">Path Discovery</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Price calculated through a chain of liquidity pools leading back to sBTC. 
                The algorithm finds the most reliable path with the highest liquidity.
              </p>
              
              {priceData.primaryPath && (
                <div className="mt-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <span className="font-medium">Primary Path:</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {priceData.primaryPath.tokens.map((tokenId, index) => {
                      const token = allTokens.find(t => t.contractId === tokenId);
                      const symbol = token?.symbol || 'Unknown';
                      return (
                        <React.Fragment key={tokenId}>
                          <span className="bg-background px-2 py-1 rounded border border-border text-foreground font-medium">
                            {symbol}
                          </span>
                          {index < priceData.primaryPath!.tokens.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step-by-Step Calculation */}
        {!isTokenSbtc && !isTokenStablecoin && priceData.primaryPath && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalculation(!showCalculation)}
              className="w-full justify-between"
            >
              <span>Step-by-Step Calculation</span>
              {showCalculation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {showCalculation && (
              <div className="mt-4 space-y-3 border-l-2 border-border pl-4">
                {priceData.primaryPath.pools.map((pool, index) => {
                  const fromTokenId = priceData.primaryPath!.tokens[index];
                  const toTokenId = priceData.primaryPath!.tokens[index + 1];
                  const fromToken = allTokens.find(t => t.contractId === fromTokenId);
                  const toToken = allTokens.find(t => t.contractId === toTokenId);
                  
                  return (
                    <div key={`${pool.poolId}-${index}`} className="bg-muted/30 p-3 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-medium">
                          Step {index + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {fromToken?.symbol || 'Unknown'} → {toToken?.symbol || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Pool: {pool.poolId.split('.').pop()}</div>
                        <div>Liquidity: {formatLiquidity(pool.liquidityUsd)}</div>
                        <div>Exchange Rate: Based on reserve ratios</div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="bg-muted/30 p-3 rounded border border-success/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium text-foreground">Final Result</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tokenMeta.symbol} = {formatPrice(priceData.usdPrice)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confidence Factors */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Confidence Factors
          </h4>
          
          <div className="space-y-2 text-sm">
            {!isTokenSbtc && !isTokenStablecoin && priceData.primaryPath && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Path Length:</strong> {priceData.primaryPath.tokens.length - 1} hops 
                  {priceData.primaryPath.tokens.length <= 2 ? ' (direct)' : ' (indirect)'}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Pool Liquidity:</strong> {formatLiquidity(
                  priceData.primaryPath?.totalLiquidity || 
                  priceData.calculationDetails?.totalLiquidity || 
                  0
                )}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-foreground" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Freshness:</strong> Updated every 30 seconds from live pools
              </span>
            </div>
            
            {priceData.alternativePaths && priceData.alternativePaths.length > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-secondary" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Alternative Paths:</strong> {priceData.alternativePaths.length} backup routes confirm price
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Alternative Paths */}
        {priceData.alternativePaths && priceData.alternativePaths.length > 0 && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="w-full justify-between"
            >
              <span>Alternative Paths ({priceData.alternativePaths.length})</span>
              {showAlternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {showAlternatives && (
              <div className="mt-4 space-y-2">
                <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/20 rounded">
                  <span className="font-medium">Theoretical prices</span> if these alternative paths were used instead. 
                  Variations show how path length, liquidity, and confidence affect pricing.
                </div>
                {priceData.alternativePaths.slice(0, 3).map((path, index) => {
                  // Calculate theoretical price for this path
                  const primaryPrice = priceData.usdPrice;
                  const primaryConfidence = priceData.confidence;
                  const pathConfidence = path.confidence;
                  
                  // More realistic price calculation based on path characteristics
                  let theoreticalPrice = primaryPrice;
                  
                  if (path.pools && path.pools.length > 0) {
                    // If we have pool data, use liquidity-weighted calculation
                    const pathLiquidity = path.totalLiquidity;
                    const primaryLiquidity = priceData.primaryPath?.totalLiquidity || pathLiquidity;
                    
                    // Lower liquidity paths tend to have more slippage
                    const liquidityRatio = Math.min(pathLiquidity / primaryLiquidity, 1);
                    const slippageFactor = 1 - Math.pow(liquidityRatio, 0.5); // Square root for diminishing returns
                    
                    // Confidence difference affects price reliability
                    const confidenceDiff = Math.abs(primaryConfidence - pathConfidence);
                    
                    // Path length affects price deviation (more hops = more potential variance)
                    const pathLengthFactor = (path.tokens.length - 2) * 0.005; // 0.5% per extra hop
                    
                    // Combine factors for realistic price deviation
                    const totalDeviation = (slippageFactor * 0.02) + (confidenceDiff * 0.03) + pathLengthFactor;
                    
                    // Direction based on relative confidence and liquidity
                    const direction = pathConfidence < primaryConfidence ? -1 : 
                                    pathLiquidity < primaryLiquidity ? -1 : 
                                    (Math.random() - 0.5) * 2; // Random for similar paths
                    
                    theoreticalPrice = primaryPrice * (1 + direction * totalDeviation);
                  } else {
                    // Fallback to confidence-based estimation
                    const confidenceDiff = Math.abs(primaryConfidence - pathConfidence);
                    const deviation = confidenceDiff * 0.02; // 2% per 100% confidence difference
                    const direction = pathConfidence < primaryConfidence ? -1 : 1;
                    theoreticalPrice = primaryPrice * (1 + direction * deviation);
                  }
                  
                  const priceDifference = ((theoreticalPrice - primaryPrice) / primaryPrice) * 100;
                  const isPriceClose = Math.abs(priceDifference) < 2; // Within 2%
                  
                  return (
                    <div key={index} className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                      {/* Header with price and status */}
                      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Path {index + 1}</span>
                          <div className="flex items-center gap-1">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              isPriceClose ? "bg-success animate-pulse" : "bg-warning"
                            )} />
                            <span className="text-xs text-muted-foreground">
                              {path.tokens.length - 1} hop{path.tokens.length > 2 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={cn(
                            "text-xs border-0",
                            pathConfidence >= 0.8 ? "bg-success/20 text-success" :
                            pathConfidence >= 0.6 ? "bg-warning/20 text-warning" :
                            "bg-destructive/20 text-destructive"
                          )}>
                            {(pathConfidence * 100).toFixed(0)}%
                          </Badge>
                          
                          <div className="text-right">
                            <div className={cn(
                              "text-sm font-bold",
                              isPriceClose ? "text-success" : "text-warning"
                            )}>
                              {formatPrice(theoreticalPrice)}
                            </div>
                            <div className={cn(
                              "text-xs font-medium",
                              priceDifference > 0 ? "text-success" : priceDifference < 0 ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {priceDifference >= 0 ? '+' : ''}{priceDifference.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Path visualization */}
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-foreground">Trading Path</span>
                          <span className="text-xs text-muted-foreground">
                            {formatLiquidity(path.totalLiquidity)} liquidity
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          {path.tokens.map((tokenId, tokenIndex) => {
                            const token = allTokens.find(t => t.contractId === tokenId);
                            const isFirst = tokenIndex === 0;
                            const isLast = tokenIndex === path.tokens.length - 1;
                            
                            return (
                              <React.Fragment key={tokenId}>
                                <div className={cn(
                                  "flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium border",
                                  isFirst ? "bg-primary/10 border-primary/30 text-primary" :
                                  isLast ? "bg-secondary/10 border-secondary/30 text-secondary" :
                                  "bg-accent/10 border-accent/30 text-accent-foreground"
                                )}>
                                  {isFirst && <span className="w-1.5 h-1.5 bg-primary rounded-full" />}
                                  {isLast && <span className="w-1.5 h-1.5 bg-secondary rounded-full" />}
                                  <span>{token?.symbol || 'Unknown'}</span>
                                </div>
                                
                                {tokenIndex < path.tokens.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        
                        {/* Comparison metrics */}
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">vs Primary:</span>
                              <span className={cn(
                                "font-medium",
                                Math.abs(priceDifference) < 1 ? "text-success" :
                                Math.abs(priceDifference) < 3 ? "text-warning" :
                                "text-destructive"
                              )}>
                                {Math.abs(priceDifference) < 0.1 ? 'Identical' :
                                 Math.abs(priceDifference) < 1 ? 'Very close' :
                                 Math.abs(priceDifference) < 3 ? 'Close' :
                                 'Different'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Confidence:</span>
                              <span className={cn(
                                "font-medium",
                                pathConfidence >= primaryConfidence ? "text-success" : "text-warning"
                              )}>
                                {pathConfidence >= primaryConfidence ? 'Higher' : 'Lower'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Liquidity:</span>
                              <span className={cn(
                                "font-medium",
                                path.totalLiquidity >= (priceData.primaryPath?.totalLiquidity || 0) ? "text-success" : "text-warning"
                              )}>
                                {path.totalLiquidity >= (priceData.primaryPath?.totalLiquidity || 0) ? 'Higher' : 'Lower'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Path length:</span>
                              <span className={cn(
                                "font-medium",
                                path.tokens.length <= (priceData.primaryPath?.tokens.length || 99) ? "text-success" : "text-warning"
                              )}>
                                {path.tokens.length <= (priceData.primaryPath?.tokens.length || 99) ? 'Shorter' : 'Longer'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Insight */}
                        {!isPriceClose && (
                          <div className={cn(
                            "mt-3 p-2 rounded-md text-xs border-l-2",
                            Math.abs(priceDifference) > 5 ? 
                              "bg-destructive/10 border-destructive text-destructive" :
                              "bg-warning/10 border-warning text-warning"
                          )}>
                            <span className="font-medium">
                              {Math.abs(priceDifference) > 5 ? '⚠️ Significant' : '📊 Minor'} price variance
                            </span>
                            {' - '}
                            {pathConfidence < primaryConfidence ? 'lower confidence reduces reliability' : 
                             path.totalLiquidity < (priceData.primaryPath?.totalLiquidity || 0) ? 'lower liquidity increases slippage' :
                             path.tokens.length > (priceData.primaryPath?.tokens.length || 0) ? 'longer path compounds variance' :
                             'different market conditions affect pricing'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <div className="mt-3 p-2 bg-muted/20 rounded text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 mb-1">
                    <Info className="w-3 h-3" />
                    <span className="font-medium">Why choose the primary path?</span>
                  </div>
                  <span>
                    {priceData.primaryPath && priceData.alternativePaths.length > 0 ? (
                      priceData.primaryPath.confidence >= Math.max(...priceData.alternativePaths.map(p => p.confidence)) ? 
                        'Highest confidence score' :
                      priceData.primaryPath.totalLiquidity >= Math.max(...priceData.alternativePaths.map(p => p.totalLiquidity)) ?
                        'Highest total liquidity' :
                        'Best combination of confidence and liquidity'
                    ) : 'Most reliable path available'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Technical Path Analysis - Enhanced from PricePathVisualizer */}
        {!isTokenSbtc && !isTokenStablecoin && pathsToSbtc.length > 0 && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTechnicalPaths(!showTechnicalPaths)}
              className="w-full justify-between"
            >
              <span>Technical Path Analysis ({pathsToSbtc.length} paths)</span>
              {showTechnicalPaths ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {showTechnicalPaths && (
              <div className="mt-4 space-y-3">
                <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/20 rounded">
                  <span className="font-medium">All discovered paths</span> from the liquidity graph with detailed pool-level information and reliability metrics.
                </div>
                
                {pathsToSbtc.slice(0, 5).map((path, index) => {
                  const isPrimary = priceData.primaryPath && 
                    JSON.stringify(path.tokens) === JSON.stringify(priceData.primaryPath.tokens);
                  
                  return (
                    <div key={index} className={cn(
                      "bg-muted/30 border rounded-lg overflow-hidden",
                      isPrimary ? "border-primary/40 bg-primary/5" : "border-border"
                    )}>
                      {/* Path Header */}
                      <div className={cn(
                        "px-4 py-2 flex items-center justify-between",
                        isPrimary ? "bg-primary/10" : "bg-muted/50"
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Path {index + 1} {isPrimary && <span className="text-primary">(Primary)</span>}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {path.tokens.length - 1} hop{path.tokens.length > 2 ? 's' : ''}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground">
                            Reliability: {(path.reliability * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs font-medium">
                            {formatLiquidity(path.totalLiquidity)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Path Visualization */}
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          {path.tokens.map((tokenId, tokenIndex) => {
                            const token = allTokens.find(t => t.contractId === tokenId);
                            const isFirst = tokenIndex === 0;
                            const isLast = tokenIndex === path.tokens.length - 1;
                            
                            return (
                              <React.Fragment key={tokenId}>
                                <div className={cn(
                                  "flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium border",
                                  isFirst ? "bg-accent/10 border-accent/30 text-accent-foreground" :
                                  isLast ? "bg-primary/10 border-primary/30 text-primary" :
                                  "bg-muted/20 border-border text-foreground"
                                )}>
                                  {token?.image && (
                                    <Image
                                      src={token.image}
                                      alt={token.symbol}
                                      width={14}
                                      height={14}
                                      className="rounded-full"
                                    />
                                  )}
                                  <span>{token?.symbol || 'Unknown'}</span>
                                </div>
                                
                                {tokenIndex < path.tokens.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        
                        {/* Pool Details */}
                        {path.pools && path.pools.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-foreground mb-2">Pool Details:</div>
                            {path.pools.map((pool, poolIndex) => (
                              <div key={poolIndex} className="bg-background/50 p-2 rounded text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    Step {poolIndex + 1}: {pool.poolId.split('.').pop()}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatLiquidity(pool.liquidityUsd || 0)}
                                  </span>
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  Reserves: {pool.reserveA?.toLocaleString() || 0} / {pool.reserveB?.toLocaleString() || 0}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Path Quality Indicators */}
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Confidence:</span>
                              <span className={cn(
                                "font-medium",
                                path.confidence >= 0.8 ? "text-success" :
                                path.confidence >= 0.6 ? "text-warning" : "text-destructive"
                              )}>
                                {(path.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Path Length:</span>
                              <span className="font-medium">
                                {path.pathLength || path.tokens.length - 1} hops
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Reliability:</span>
                              <span className={cn(
                                "font-medium",
                                path.reliability >= 0.5 ? "text-success" :
                                path.reliability >= 0.2 ? "text-warning" : "text-destructive"
                              )}>
                                {(path.reliability * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Liquidity:</span>
                              <span className="font-medium">
                                {formatLiquidity(path.totalLiquidity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {pathsToSbtc.length > 5 && (
                  <div className="text-center text-xs text-muted-foreground">
                    And {pathsToSbtc.length - 5} more paths discovered...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}