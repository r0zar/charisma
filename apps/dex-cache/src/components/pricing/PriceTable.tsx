'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowUp, 
  ArrowDown, 
  ChevronDown, 
  ChevronUp,
  Bitcoin,
  TrendingUp,
  Clock,
  Activity,
  Coins,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface PriceTableData {
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
  calculationDetails?: {
    btcPrice: number;
    pathsUsed: number;
    totalLiquidity: number;
    priceVariation: number;
  };
  primaryPath?: {
    tokens: string[];
    poolCount: number;
    totalLiquidity: number;
    reliability: number;
    confidence: number;
  };
  alternativePathCount?: number;
}

interface PriceTableProps {
  data: PriceTableData[];
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: 'symbol' | 'price' | 'confidence' | 'liquidity' | 'lastUpdated') => void;
  showDetails: boolean;
  isRefreshing: boolean;
  priceDisplay: 'usd' | 'sat';
  onPriceDisplayToggle: () => void;
}

// Utility functions
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

const formatSatoshis = (usdPrice: number | null | undefined, btcPrice: number = 100000): string => {
  if (usdPrice === null || usdPrice === undefined || isNaN(usdPrice) || btcPrice === 0) {
    return '—';
  }
  
  // Convert USD to satoshis: (USD price / BTC price) * 100,000,000 sats per BTC
  const satoshis = (usdPrice / btcPrice) * 100000000;
  
  if (satoshis >= 1000) {
    return `${satoshis.toLocaleString(undefined, { maximumFractionDigits: 0 })} sats`;
  } else if (satoshis >= 1) {
    return `${satoshis.toFixed(2)} sats`;
  } else {
    return `${satoshis.toFixed(6)} sats`;
  }
};

const formatUnifiedPrice = (usdPrice: number | null | undefined, priceDisplay: 'usd' | 'sat', btcPrice: number = 100000): string => {
  if (priceDisplay === 'usd') {
    return formatPrice(usdPrice);
  } else {
    return formatSatoshis(usdPrice, btcPrice);
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
  if (confidence >= 0.8) return 'text-green-600 border-green-500/20 bg-green-500/10';
  if (confidence >= 0.6) return 'text-yellow-600 border-yellow-500/20 bg-yellow-500/10';
  return 'text-red-600 border-red-500/20 bg-red-500/10';
};

const getPathTypeLabel = (pathLength: number): { label: string; color: string } => {
  if (pathLength <= 2) {
    return { label: 'Direct', color: 'text-green-600 bg-green-500/10 border-green-500/20' };
  } else if (pathLength === 3) {
    return { label: 'Single Hop', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' };
  } else {
    return { label: 'Multi Hop', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' };
  }
};

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

export default function PriceTable({ 
  data, 
  sortBy, 
  sortDir, 
  onSort, 
  showDetails, 
  isRefreshing,
  priceDisplay,
  onPriceDisplayToggle 
}: PriceTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const SortHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <th 
      className="p-4 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          sortDir === 'asc' ? 
            <ArrowUp className="w-3 h-3" /> : 
            <ArrowDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  const toggleExpanded = (tokenId: string) => {
    setExpandedRow(expandedRow === tokenId ? null : tokenId);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Coins className="w-12 h-12 mx-auto mb-4 text-muted" />
        <p className="text-lg font-semibold">No tokens found</p>
        <p className="text-sm mt-1">Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-foreground">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider">
          <tr>
            <SortHeader column="symbol">Token</SortHeader>
            <th className="p-4 font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPriceDisplayToggle}
                  className="h-6 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {priceDisplay === 'usd' ? (
                    <><DollarSign className="w-3 h-3 mr-1" />USD Price</>
                  ) : (
                    <><Bitcoin className="w-3 h-3 mr-1" />SAT Price</>
                  )}
                </Button>
              </div>
            </th>
            <SortHeader column="liquidity">Total Liquidity</SortHeader>
            <SortHeader column="confidence">Confidence</SortHeader>
            <th className="p-4 font-semibold text-muted-foreground">Path Type</th>
            <SortHeader column="lastUpdated">Last Updated</SortHeader>
            {showDetails && <th className="p-4 font-semibold text-muted-foreground">Details</th>}
            <th className="p-4 font-semibold text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item) => {
            const isExpanded = expandedRow === item.tokenId;
            const pathType = item.primaryPath ? getPathTypeLabel(item.primaryPath.tokens?.length || 0) : null;
            
            return (
              <React.Fragment key={item.tokenId}>
                {/* Main Row */}
                <tr className={`hover:bg-muted/10 transition-colors ${isExpanded ? 'bg-muted/20' : ''}`}>
                  {/* Token Info */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-border flex items-center justify-center overflow-hidden">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={`${item.symbol} logo`}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {item.symbol.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{item.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-32">
                          {item.name}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Unified Price */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="text-lg font-bold text-foreground">
                      {formatUnifiedPrice(item.usdPrice, priceDisplay)}
                    </div>
                  </td>

                  {/* Total Liquidity */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-blue-500" />
                      <span className="font-semibold text-foreground">
                        {formatLiquidity(item.totalLiquidity || item.calculationDetails?.totalLiquidity)}
                      </span>
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="p-4 whitespace-nowrap">
                    <Badge variant="outline" className={getConfidenceColor(item.confidence)}>
                      {(item.confidence * 100).toFixed(0)}%
                    </Badge>
                  </td>

                  {/* Path Type */}
                  <td className="p-4 whitespace-nowrap">
                    {pathType ? (
                      <Badge variant="outline" className={pathType.color}>
                        {pathType.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>

                  {/* Last Updated */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(item.lastUpdated)}
                    </div>
                  </td>

                  {/* Details */}
                  {showDetails && (
                    <td className="p-4 whitespace-nowrap">
                      {item.calculationDetails && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>{item.calculationDetails.pathsUsed} paths</div>
                          <div>${(item.calculationDetails.totalLiquidity || 0).toLocaleString()} TVL</div>
                        </div>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {showDetails && item.primaryPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(item.tokenId)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Link href={`/prices/${item.tokenId}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {isExpanded && showDetails && item.primaryPath && (
                  <tr className="bg-muted/10">
                    <td colSpan={showDetails ? 7 : 6} className="p-4">
                      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                        <h4 className="font-semibold text-foreground mb-3">Price Discovery Details</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Primary Path */}
                          <div>
                            <h5 className="text-sm font-medium text-foreground mb-2">Primary Path</h5>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Activity className="w-4 h-4 text-primary" />
                                <span className="text-muted-foreground">
                                  {item.primaryPath.tokens?.join(' → ') || 'Path unavailable'}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Pools: {item.primaryPath.poolCount}</div>
                                <div>Liquidity: ${item.primaryPath.totalLiquidity?.toLocaleString() || '0'}</div>
                                <div>Reliability: {(item.primaryPath.reliability * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                          </div>

                          {/* Calculation Details */}
                          {item.calculationDetails && (
                            <div>
                              <h5 className="text-sm font-medium text-foreground mb-2">Calculation</h5>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>BTC Price: ${item.calculationDetails.btcPrice?.toLocaleString() || 'N/A'}</div>
                                <div>Paths Used: {item.calculationDetails.pathsUsed}</div>
                                <div>Price Variation: {((item.calculationDetails.priceVariation || 0) * 100).toFixed(2)}%</div>
                                <div>Alternative Paths: {item.alternativePathCount || 0}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      
      {isRefreshing && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Updating prices...</span>
          </div>
        </div>
      )}
    </div>
  );
}