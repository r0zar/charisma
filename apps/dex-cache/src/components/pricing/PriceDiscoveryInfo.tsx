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
            Each price path receives a dynamic weight based on multiple factors, creating 
            manipulation-resistant pricing through liquidity-weighted averages.
          </p>
          
          <div className="space-y-2">
            <div className="font-medium text-foreground">Weight Calculation Components:</div>
            <div className="ml-2 space-y-1">
              <div>• <span className="font-medium">Base Score:</span> Path reliability × confidence</div>
              <div>• <span className="font-medium">Path Length Penalty:</span> Longer paths get reduced weight</div>
              <div>• <span className="font-medium">Liquidity Boost:</span> Up to 2x boost based on minimum pool liquidity</div>
              <div>• <span className="font-medium">Recency Factor:</span> Recent data gets higher priority</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-foreground">Multi-Pass Price Discovery:</div>
            <div className="ml-2 space-y-1">
              <div>1. <span className="font-medium">Path Analysis:</span> Calculate price for each route</div>
              <div>2. <span className="font-medium">Outlier Removal:</span> Filter prices &gt;50% from median</div>
              <div>3. <span className="font-medium">Weighted Average:</span> Combine remaining paths by weight</div>
              <div>4. <span className="font-medium">Confidence Scoring:</span> Price consistency + liquidity + path count</div>
            </div>
          </div>
          
          <p className="text-xs">
            This system means that as more passes occur and paths are discovered, 
            both prices and confidence scores become more accurate through better 
            outlier detection and more comprehensive liquidity weighting.
          </p>
        </CardContent>
      </Card>
    </>
  );
}