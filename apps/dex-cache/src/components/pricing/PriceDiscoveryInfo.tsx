'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Bitcoin, 
  TrendingUp, 
  Network, 
  Shield, 
  Info, 
  RefreshCw,
  ExternalLink 
} from 'lucide-react';

interface BtcPriceData {
  price: number;
  source: string;
  confidence: number;
  timestamp: number;
}

export default function PriceDiscoveryInfo() {
  const [btcPrice, setBtcPrice] = useState<BtcPriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        // Skip API calls during build time
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }
        
        const response = await fetch('/api/v1/prices/btc', {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (response.ok) {
          const data = await response.json();
          setBtcPrice(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch BTC price:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBtcPrice();
    
    // Update BTC price every 5 minutes
    const interval = setInterval(fetchBtcPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <h2 className="text-xl font-semibold text-primary mb-4">How Pricing Works</h2>
      
      {/* BTC Price Anchor Widget */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Bitcoin className="h-5 w-5 mr-2 text-primary" />
            Bitcoin Price Anchor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : btcPrice ? (
            <>
              <div className="text-2xl font-bold text-foreground">
                ${btcPrice.price.toLocaleString()}
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {btcPrice.source}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {(btcPrice.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Updated {new Date(btcPrice.timestamp).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Price unavailable</p>
          )}
          <p className="text-sm text-muted-foreground">
            All token prices derive from sBTC which tracks Bitcoin 1:1
          </p>
        </CardContent>
      </Card>

      {/* Multi-Path Discovery */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Network className="h-5 w-5 mr-2 text-primary" />
            Multi-Path Discovery
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Direct sBTC pairs (highest confidence)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>Via STX or major tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Multi-hop through liquidity</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Scoring */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Shield className="h-5 w-5 mr-2 text-primary" />
            Confidence Scoring
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Confidence scores reflect liquidity depth, path consistency, and data freshness. 
          Higher scores indicate more reliable pricing with better market depth.
          <div className="mt-3 space-y-1">
            <div className="flex justify-between">
              <span>High (≥80%)</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Excellent
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Medium (60-79%)</span>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                Good
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Low (&lt;60%)</span>
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                Caution
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liquidity-Based Weighting */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Liquidity Weighting System
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Advanced price discovery system using decimal-aware calculations and dynamic 
            weighting to provide accurate, manipulation-resistant token pricing.
          </p>
          
          <div className="space-y-2">
            <div className="font-medium text-foreground">Decimal-Aware Pricing:</div>
            <div className="ml-2 space-y-1">
              <div>• <span className="font-medium">Proper Conversion:</span> Atomic reserves converted to decimal values</div>
              <div>• <span className="font-medium">Accurate Ratios:</span> Exchange rates calculated with correct decimals</div>
              <div>• <span className="font-medium">Cross-Pool Consistency:</span> Unified decimal handling across all pools</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-foreground">Dynamic Path Weighting:</div>
            <div className="ml-2 space-y-1">
              <div>• <span className="font-medium">Base Score:</span> Path reliability × confidence (min 1%)</div>
              <div>• <span className="font-medium">Length Penalty:</span> 10% reduction per additional hop</div>
              <div>• <span className="font-medium">Liquidity Boost:</span> Up to 2x multiplier based on minimum pool size</div>
              <div>• <span className="font-medium">Recency Factor:</span> Age penalty for stale pool data</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-foreground">Price Discovery Process:</div>
            <div className="ml-2 space-y-1">
              <div>1. <span className="font-medium">Path Discovery:</span> Find all viable routes to sBTC</div>
              <div>2. <span className="font-medium">Decimal Calculation:</span> Compute exchange rates with proper decimals</div>
              <div>3. <span className="font-medium">Outlier Filtering:</span> Remove prices &gt;50% from median</div>
              <div>4. <span className="font-medium">Weighted Average:</span> Combine paths by dynamic weights</div>
              <div>5. <span className="font-medium">Confidence Scoring:</span> Based on consistency, liquidity, and path count</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-foreground">Special Handling:</div>
            <div className="ml-2 space-y-1">
              <div>• <span className="font-medium">Stablecoin Anchoring:</span> USD-pegged tokens use $1.00 reference</div>
              <div>• <span className="font-medium">sBTC Oracle:</span> Direct Bitcoin price feed integration</div>
              <div>• <span className="font-medium">Pool Skipping:</span> Stablecoin/stablecoin pairs bypass constant product</div>
            </div>
          </div>
          
          <p className="text-xs">
            Recent improvements include fixing decimal conversion bugs that were causing 
            100x price inflation and implementing proper atomic-to-decimal reserve calculations.
          </p>
        </CardContent>
      </Card>
    </>
  );
}