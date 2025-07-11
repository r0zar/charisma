'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  RefreshCw, 
  Loader2,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import PriceTable from './PriceTable';

interface PriceFilters {
  search: string;
  minConfidence: number;
  pathType: 'all' | 'direct' | 'single-hop' | 'multi-hop';
  sortBy: 'symbol' | 'price' | 'marketPrice' | 'intrinsicValue' | 'confidence' | 'liquidity' | 'lastUpdated' | 'nestLevel';
  sortDir: 'asc' | 'desc';
  priceDisplay: 'usd' | 'sat';
}

interface CalculationDetails {
  btcPrice: number;
  pathsUsed: number;
  priceVariation: number;
  priceSource?: 'market' | 'intrinsic' | 'hybrid';
}

interface PrimaryPath {
  tokens: string[];
  poolCount: number;
  totalLiquidity: number;
  reliability: number;
  confidence: number;
  pathLength: number;
}

interface TokenData {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  image?: string;
  usdPrice: number;
  sbtcRatio: number;
  confidence: number;
  lastUpdated: number;
  totalLiquidity?: number; // Total USD liquidity across all pools for this token
  calculationDetails?: CalculationDetails;
  primaryPath?: PrimaryPath;
  alternativePathCount?: number;
  // Enhanced pricing fields
  isLpToken?: boolean;
  intrinsicValue?: number;
  marketPrice?: number;
  priceDeviation?: number;
  isArbitrageOpportunity?: boolean;
  nestLevel?: number;
}

interface ApiResponse {
  status: string;
  data: TokenData[];
  metadata: {
    count: number;
    totalTokensAvailable: number;
    individualTokensAvailable?: number;
    lpTokensAvailable?: number;
    processingTimeMs: number;
    servedFromCache?: boolean;
    cacheAge?: number;
    revalidating?: boolean;
  };
}

export default function PriceTableContainer() {
  const [priceData, setPriceData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const [filters, setFilters] = useState<PriceFilters>({
    search: '',
    minConfidence: 0,
    pathType: 'all',
    sortBy: 'liquidity',
    sortDir: 'desc',
    priceDisplay: 'usd'
  });

  const fetchPriceData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Skip API calls during build time
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        limit: '100',
        details: 'true',
        minConfidence: filters.minConfidence.toString()
      });

      const response = await fetch(`/api/v1/prices?${params}`, {
        signal: AbortSignal.timeout(30000) // 30 second timeout for LP dependency processing
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse = await response.json();
      
      console.log('[PriceTableContainer] Received data:', {
        status: data.status,
        tokenCount: data.data?.length || 0,
        sampleToken: data.data?.[0],
        fullData: data
      });
      
      if (data.status !== 'success') {
        throw new Error(`API returned error status: ${data.status}`);
      }

      setPriceData(data);
      setLastUpdated(Date.now());
      
      // Log if we have no pricing data
      if (!data.data || data.data.length === 0) {
        console.warn('[PriceTableContainer] No pricing data received - cache may not be warmed yet');
        console.log('[PriceTableContainer] Full response:', JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error('Failed to fetch price data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch price data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPriceData();
  }, [filters.minConfidence]);

  // Smart polling: More frequent when page is active, less when in background
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let isTabActive = true;
    
    // Smart polling based on tab visibility and data freshness
    const startPolling = () => {
      const pollInterval = isTabActive ? 30 * 1000 : 60 * 1000; // 30s active, 60s background
      
      interval = setInterval(() => {
        // Only poll if tab is active or data is getting stale
        const dataAge = priceData?.metadata?.cacheAge || 0;
        const shouldPoll = isTabActive || dataAge > 90 * 1000; // Poll if > 90s old
        
        if (shouldPoll) {
          fetchPriceData(true);
        }
      }, pollInterval);
    };
    
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
      
      // Clear existing interval and restart with new frequency
      if (interval) clearInterval(interval);
      startPolling();
      
      // Immediately fetch fresh data when tab becomes active
      if (isTabActive && priceData) {
        const dataAge = priceData.metadata?.cacheAge || 0;
        if (dataAge > 30 * 1000) { // If data is > 30s old, refresh immediately
          fetchPriceData(true);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [filters.minConfidence, priceData]);

  // Filter and sort the price data
  const filteredAndSortedData = useMemo(() => {
    console.log('[PriceTableContainer] Filtering data:', {
      hasPriceData: !!priceData,
      dataArray: priceData?.data,
      dataLength: priceData?.data?.length,
      filters
    });
    
    if (!priceData?.data) return [];

    const filtered = priceData.data.filter(item => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          item.symbol.toLowerCase().includes(searchLower) ||
          item.name.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Confidence filter
      if (item.confidence < filters.minConfidence / 100) return false;

      // Path type filter
      if (filters.pathType !== 'all' && item.primaryPath) {
        const pathLength = item.primaryPath.tokens?.length || 0;
        switch (filters.pathType) {
          case 'direct':
            if (pathLength !== 2) return false; // Token -> sBTC
            break;
          case 'single-hop':
            if (pathLength !== 3) return false; // Token -> Intermediate -> sBTC
            break;
          case 'multi-hop':
            if (pathLength <= 3) return false; // More than 2 hops
            break;
        }
      }

      return true;
    });

    // Sort the filtered data
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (filters.sortBy) {
        case 'symbol':
          compareValue = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          compareValue = a.usdPrice - b.usdPrice;
          break;
        case 'marketPrice':
          const aMarket = a.marketPrice || 0;
          const bMarket = b.marketPrice || 0;
          // Handle null values - put them at the bottom
          if (aMarket === 0 && bMarket === 0) {
            compareValue = 0;
          } else if (aMarket === 0) {
            return 1; // a goes to bottom
          } else if (bMarket === 0) {
            return -1; // b goes to bottom
          } else {
            compareValue = aMarket - bMarket;
          }
          break;
        case 'intrinsicValue':
          const aIntrinsic = a.intrinsicValue || 0;
          const bIntrinsic = b.intrinsicValue || 0;
          // Handle null values - put them at the bottom
          if (aIntrinsic === 0 && bIntrinsic === 0) {
            compareValue = 0;
          } else if (aIntrinsic === 0) {
            return 1; // a goes to bottom
          } else if (bIntrinsic === 0) {
            return -1; // b goes to bottom
          } else {
            compareValue = aIntrinsic - bIntrinsic;
          }
          break;
        case 'nestLevel':
          const aNest = a.nestLevel || 0;
          const bNest = b.nestLevel || 0;
          // Handle null values - put them at the bottom (non-LP tokens)
          if (aNest === 0 && bNest === 0) {
            compareValue = 0;
          } else if (aNest === 0) {
            return 1; // a goes to bottom
          } else if (bNest === 0) {
            return -1; // b goes to bottom
          } else {
            compareValue = aNest - bNest;
          }
          break;
        case 'confidence':
          compareValue = a.confidence - b.confidence;
          break;
        case 'liquidity':
          // Handle N/A values (null, undefined, or 0) - always put them at the bottom
          const aLiquidity = a.totalLiquidity || 0;
          const bLiquidity = b.totalLiquidity || 0;
          
          // If both are 0/null, treat as equal
          if (aLiquidity === 0 && bLiquidity === 0) {
            compareValue = 0;
          }
          // If only a is 0/null, put it after b (bottom regardless of sort direction)
          else if (aLiquidity === 0) {
            // Return early to avoid sort direction flip - always put N/A at bottom
            return 1;
          }
          // If only b is 0/null, put it after a (bottom regardless of sort direction)
          else if (bLiquidity === 0) {
            // Return early to avoid sort direction flip - always put N/A at bottom
            return -1;
          }
          // Both have valid values, sort normally
          else {
            compareValue = aLiquidity - bLiquidity;
          }
          break;
        case 'lastUpdated':
          compareValue = a.lastUpdated - b.lastUpdated;
          break;
      }

      return filters.sortDir === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [priceData, filters]);

  const handleSort = (column: PriceFilters['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleRefresh = () => {
    fetchPriceData(true);
  };

  const handlePriceDisplayToggle = () => {
    setFilters(prev => ({
      ...prev,
      priceDisplay: prev.priceDisplay === 'usd' ? 'sat' : 'usd'
    }));
  };

  if (isLoading && !priceData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <span className="text-lg">Loading token prices...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !priceData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Prices</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchPriceData()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Token Prices
              {priceData && (
                <Badge variant="secondary" className="ml-2">
                  {filteredAndSortedData.length} of {priceData.data.length}
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
              {priceData && (
                <span className="ml-2">
                  • {priceData.metadata.processingTimeMs}ms response time
                  {priceData.metadata.servedFromCache && (
                    <span className="ml-2">
                      • <span className="text-green-600">Cached</span>
                      {priceData.metadata.cacheAge && (
                        <span className="ml-1">
                          ({Math.round(priceData.metadata.cacheAge / 1000)}s old)
                        </span>
                      )}
                      {priceData.metadata.revalidating && (
                        <span className="ml-1 text-blue-600">• Updating...</span>
                      )}
                    </span>
                  )}
                  {priceData.metadata.lpTokensAvailable !== undefined && (
                    <span className="ml-2">
                      • {priceData.metadata.lpTokensAvailable} LP tokens
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {priceData?.metadata?.revalidating && (
              <div className="flex items-center text-sm text-blue-600">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search tokens..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filters.pathType}
              onChange={(e) => setFilters(prev => ({ ...prev, pathType: e.target.value as any }))}
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="all">All Paths</option>
              <option value="direct">Direct sBTC</option>
              <option value="single-hop">Single Hop</option>
              <option value="multi-hop">Multi Hop</option>
            </select>
            
            <select
              value={filters.minConfidence}
              onChange={(e) => setFilters(prev => ({ ...prev, minConfidence: Number(e.target.value) }))}
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value={0}>All Confidence</option>
              <option value={80}>High (≥80%)</option>
              <option value={60}>Medium (≥60%)</option>
              <option value={40}>Low (≥40%)</option>
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <PriceTable
          data={filteredAndSortedData}
          sortBy={filters.sortBy}
          sortDir={filters.sortDir}
          onSort={handleSort}
          showDetails={true}
          isRefreshing={isRefreshing}
          priceDisplay={filters.priceDisplay}
          onPriceDisplayToggle={handlePriceDisplayToggle}
        />
      </CardContent>
    </Card>
  );
}