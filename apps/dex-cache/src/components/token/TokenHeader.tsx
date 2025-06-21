'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Bitcoin, 
  DollarSign, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown,
  Star,
  Copy,
  CheckCircle
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TokenPriceData } from '@/lib/pricing/price-calculator';

interface TokenMeta {
  contractId: string;
  symbol: string;
  name: string;
  decimals: number;
  image?: string;
}

interface TokenHeaderProps {
  tokenMeta: TokenMeta;
  priceData: TokenPriceData | null;
}

const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined || isNaN(price)) {
    return '—';
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

const formatSbtcRatio = (ratio: number | null | undefined): string => {
  if (ratio === null || ratio === undefined || isNaN(ratio)) {
    return '—';
  }
  
  if (ratio >= 0.0001) {
    return ratio.toFixed(8);
  } else {
    return ratio.toExponential(4);
  }
};

const getConfidenceColor = (confidence: number | null): string => {
  if (confidence === null || confidence === undefined) return 'secondary';
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'danger';
};

const getConfidenceLabel = (confidence: number | null): string => {
  if (confidence === null || confidence === undefined) return 'Unknown';
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.4) return 'Low';
  return 'Very Low';
};

export default function TokenHeader({ tokenMeta, priceData }: TokenHeaderProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(tokenMeta.contractId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy contract ID:', error);
    }
  };

  const confidenceScore = priceData?.confidence || 0;
  const confidenceColor = getConfidenceColor(confidenceScore);
  const confidenceLabel = getConfidenceLabel(confidenceScore);

  return (
    <Card className="mb-8">
      <CardContent className="p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left Side - Token Identity */}
          <div className="flex items-start gap-6">
            {/* Token Avatar */}
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {tokenMeta.image ? (
                <Image
                  src={tokenMeta.image}
                  alt={`${tokenMeta.symbol} logo`}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to text avatar on image error
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={cn(
                "text-2xl font-bold text-primary",
                tokenMeta.image ? "hidden" : ""
              )}>
                {tokenMeta.symbol.slice(0, 2).toUpperCase()}
              </span>
            </div>

            {/* Token Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{tokenMeta.symbol}</h1>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    confidenceColor === 'success' && 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
                    confidenceColor === 'warning' && 'border-amber-500/30 text-amber-400 bg-amber-500/10',
                    confidenceColor === 'danger' && 'border-rose-500/30 text-rose-400 bg-rose-500/10',
                    confidenceColor === 'secondary' && 'border-border text-muted-foreground'
                  )}
                >
                  {confidenceLabel} Confidence
                </Badge>
              </div>
              
              <p className="text-xl text-muted-foreground">{tokenMeta.name}</p>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {tokenMeta.contractId.length > 30 
                    ? `${tokenMeta.contractId.slice(0, 30)}...` 
                    : tokenMeta.contractId
                  }
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyContract}
                  className="h-6 w-6 p-0"
                >
                  {copied ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Side - Price Information */}
          <div className="flex flex-col lg:items-end gap-4">
            {/* Price Display */}
            <div className="text-right">
              <div className="flex items-center gap-2 lg:justify-end">
                <DollarSign className="h-6 w-6 text-green-500" />
                <span className="text-4xl font-bold">
                  {formatPrice(priceData?.usdPrice)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-2 lg:justify-end">
                <Bitcoin className="h-4 w-4 text-orange-500" />
                <span className="text-lg text-muted-foreground">
                  {formatSbtcRatio(priceData?.sbtcRatio)} sBTC
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Star className="h-4 w-4" />
                Watch
              </Button>
              
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Explorer
              </Button>
              
              <Button size="sm" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Trade
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section - Additional Info */}
        {priceData && (
          <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confidence:</span>
              <div className="flex items-center gap-2">
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className={cn(
                      "h-2 rounded-full transition-all",
                      confidenceColor === 'success' && 'bg-emerald-500',
                      confidenceColor === 'warning' && 'bg-amber-500',
                      confidenceColor === 'danger' && 'bg-rose-500',
                      confidenceColor === 'secondary' && 'bg-muted-foreground'
                    )}
                    style={{ width: `${(confidenceScore * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {(confidenceScore * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {priceData.calculationDetails && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Paths:</span>
                  <span className="text-sm font-medium">
                    {priceData.calculationDetails.pathsUsed}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Total Liquidity:</span>
                  <span className="text-sm font-medium">
                    ${priceData.calculationDetails.totalLiquidity.toLocaleString()}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Updated:</span>
              <span className="text-sm font-medium">
                {new Date(priceData.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}