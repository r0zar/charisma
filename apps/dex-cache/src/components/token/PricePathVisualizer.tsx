'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Route, 
  Target,
  ChevronDown,
  ChevronUp,
  Bitcoin,
  TrendingUp,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PricePath } from '@/lib/pricing/price-graph';

interface PricePathVisualizerProps {
  tokenSymbol: string;
  paths: PricePath[];
  primaryPath?: PricePath;
  alternativePaths: PricePath[];
}

interface PathDisplayData {
  path: PricePath;
  isPrimary: boolean;
  steps: PathStep[];
}

interface PathStep {
  fromToken: string;
  toToken: string;
  poolLiquidity: number;
  stepReliability: number;
}

const getReliabilityColor = (reliability: number): string => {
  if (reliability >= 0.8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (reliability >= 0.6) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
};

const getPathTypeLabel = (pathLength: number): { label: string; color: string } => {
  if (pathLength <= 2) {
    return { label: 'Direct', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
  } else if (pathLength === 3) {
    return { label: 'Single Hop', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' };
  } else {
    return { label: 'Multi Hop', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' };
  }
};

const formatLiquidity = (liquidity: number): string => {
  if (liquidity >= 1000000) {
    return `$${(liquidity / 1000000).toFixed(1)}M`;
  } else if (liquidity >= 1000) {
    return `$${(liquidity / 1000).toFixed(1)}K`;
  }
  return `$${liquidity.toFixed(0)}`;
};

const getTokenSymbol = (tokenId: string): string => {
  // Extract symbol from contract ID for display
  if (tokenId === '.stx') return 'STX';
  if (tokenId.includes('sbtc-token')) return 'sBTC';
  if (tokenId.includes('charisma-token')) return 'CHA';
  if (tokenId.includes('dme000-governance-token')) return 'DMG';
  
  // Try to extract from the end of the contract ID
  const parts = tokenId.split('.');
  const lastPart = parts[parts.length - 1];
  
  // Extract token-like part from contract names
  if (lastPart.includes('token')) {
    return lastPart.replace('-token', '').replace('token', '').toUpperCase().slice(0, 4);
  }
  
  // Fallback to first few chars of last part
  return lastPart.slice(0, 4).toUpperCase();
};

const PathVisualization = ({ pathData }: { pathData: PathDisplayData }) => {
  const { path, isPrimary, steps } = pathData;
  const pathType = getPathTypeLabel(path.pathLength);
  
  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all",
      isPrimary 
        ? "border-primary/30 bg-primary/5" 
        : "border-border hover:border-border/80"
    )}>
      {/* Path Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={pathType.color}>
            {pathType.label}
          </Badge>
          {isPrimary && (
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
              Primary
            </Badge>
          )}
          <Badge 
            variant="outline" 
            className={getReliabilityColor(path.reliability)}
          >
            {(path.reliability * 100).toFixed(0)}% Reliable
          </Badge>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {formatLiquidity(path.totalLiquidity)} TVL
        </div>
      </div>

      {/* Path Visualization */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {path.tokens.map((token, index) => (
          <React.Fragment key={index}>
            {/* Token */}
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                token.includes('sbtc') 
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                  : index === 0
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              )}>
                {getTokenSymbol(token).slice(0, 2)}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {getTokenSymbol(token)}
              </span>
            </div>

            {/* Arrow (except for last token) */}
            {index < path.tokens.length - 1 && (
              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                {steps[index] && (
                  <div className="text-xs text-muted-foreground">
                    {formatLiquidity(steps[index].poolLiquidity)}
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Path Stats */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Confidence: {(path.confidence * 100).toFixed(1)}%</span>
          <span>Hops: {path.pathLength - 1}</span>
          <span>Pools: {path.pools.length}</span>
        </div>
        
        {isPrimary && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <Target className="h-3 w-3" />
            Best Route
          </div>
        )}
      </div>
    </div>
  );
};

export default function PricePathVisualizer({ 
  tokenSymbol, 
  paths, 
  primaryPath, 
  alternativePaths 
}: PricePathVisualizerProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  // Process paths for display
  const processedPaths: PathDisplayData[] = React.useMemo(() => {
    const allPaths = [
      ...(primaryPath ? [{ path: primaryPath, isPrimary: true }] : []),
      ...alternativePaths.map(path => ({ path, isPrimary: false }))
    ];

    return allPaths.map(({ path, isPrimary }) => {
      const steps: PathStep[] = [];
      
      for (let i = 0; i < path.pools.length; i++) {
        const pool = path.pools[i];
        const fromToken = path.tokens[i];
        const toToken = path.tokens[i + 1];
        
        steps.push({
          fromToken,
          toToken,
          poolLiquidity: pool.liquidityUsd || Math.sqrt(pool.reserveA * pool.reserveB),
          stepReliability: pool.weight > 0 ? Math.min(1, 1 / pool.weight) : 0
        });
      }

      return { path, isPrimary, steps };
    });
  }, [primaryPath, alternativePaths]);

  const primaryPathData = processedPaths.find(p => p.isPrimary);
  const alternativePathsData = processedPaths.filter(p => !p.isPrimary);

  if (paths.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Price Discovery Paths
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p className="text-lg font-semibold">No Price Paths Found</p>
            <p className="text-sm mt-1">
              Unable to find trading routes from {tokenSymbol} to sBTC.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Price Discovery Paths
          <Badge variant="secondary" className="ml-2">
            {paths.length} routes
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Multi-path price discovery routes from {tokenSymbol} to sBTC anchor
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Path */}
        {primaryPathData && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Primary Price Path
            </h4>
            <PathVisualization pathData={primaryPathData} />
          </div>
        )}

        {/* Alternative Paths */}
        {alternativePathsData.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-secondary" />
                Alternative Paths ({alternativePathsData.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="gap-2"
              >
                {showAlternatives ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show
                  </>
                )}
              </Button>
            </div>

            {showAlternatives && (
              <div className="space-y-3">
                {alternativePathsData.slice(0, 5).map((pathData, index) => (
                  <PathVisualization 
                    key={pathData.path.tokens.join('-')} 
                    pathData={pathData} 
                  />
                ))}
                
                {alternativePathsData.length > 5 && (
                  <div className="text-center py-2">
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Show {alternativePathsData.length - 5} more paths...
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Path Analysis Summary */}
        <div className="border-t border-border pt-4">
          <h4 className="font-semibold mb-3">Path Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Bitcoin className="h-4 w-4 text-orange-500" />
              <div>
                <div className="font-medium">Direct Routes</div>
                <div className="text-muted-foreground">
                  {paths.filter(p => p.pathLength <= 2).length} paths
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">Avg Confidence</div>
                <div className="text-muted-foreground">
                  {((paths.reduce((sum, p) => sum + p.confidence, 0) / paths.length) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="font-medium">Total Liquidity</div>
                <div className="text-muted-foreground">
                  {formatLiquidity(paths.reduce((sum, p) => sum + p.totalLiquidity, 0))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}