'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useBlaze } from 'blaze-sdk/realtime';
import TokenLogo from '@/components/TokenLogo';
import { formatTokenAmount } from '@/lib/swap-utils';
import { Wallet, TrendingUp, TrendingDown, Eye, EyeOff, ChevronDown, ChevronRight, DollarSign, X, ExternalLink, BarChart3, ArrowUpDown } from 'lucide-react';
import { TokenCacheData } from '@repo/tokens';
import { BalanceData } from 'blaze-sdk/realtime';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Local interface for processed token balance display
interface ProcessedTokenBalance {
  token: {
    contractId: string;
    name: string;
    symbol: string;
    decimals: number;
    image?: string | null;
    description?: string | null;
    type?: string | null;
  };
  balance: number;
  formattedBalance: string;
  isSubnet: boolean;
  hasSubnetBalance?: boolean;
  subnetBalance?: number;
  formattedSubnetBalance?: string;
  isLPToken?: boolean;
  lpTokenInfo?: {
    tokenAContract: string;
    tokenBContract: string;
    rebatePercent: string;
  };
  // Price data now available from enriched metadata
  priceData?: {
    price?: number | null;
    change24h?: number | null;
    marketCap?: number | null;
  };
}

export default function BalancesSettings() {
  const { address: walletAddress } = useWallet();
  const { getUserBalances } = useBlaze({ userId: walletAddress });

  // Get balances for the current user (safely handles null/undefined walletAddress)
  const balances = getUserBalances(walletAddress);

  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'value' | 'balance' | 'symbol' | 'change24h'>('value');

  // Excluded tokens state (persisted in localStorage)
  const [excludedTokens, setExcludedTokens] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('balances-excluded-tokens');
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  // Persist excluded tokens to localStorage
  const updateExcludedTokens = (newExcludedTokens: Set<string>) => {
    setExcludedTokens(newExcludedTokens);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('balances-excluded-tokens', JSON.stringify(Array.from(newExcludedTokens)));
      } catch (error) {
        console.warn('Failed to save excluded tokens to localStorage:', error);
      }
    }
  };

  // Toggle token exclusion
  const toggleTokenExclusion = (contractId: string) => {
    const newExcludedTokens = new Set(excludedTokens);
    if (newExcludedTokens.has(contractId)) {
      newExcludedTokens.delete(contractId);
    } else {
      newExcludedTokens.add(contractId);
    }
    updateExcludedTokens(newExcludedTokens);
  };

  // Combine and process token balances - now with enriched metadata including prices
  const tokenBalances = useMemo((): ProcessedTokenBalance[] => {
    if (!balances) return [];

    const balanceData: ProcessedTokenBalance[] = [];

    // balances now contains enriched metadata from the socket server
    Object.entries(balances).forEach(([contractId, balanceEntry]) => {
      const balanceNum = Number(balanceEntry.balance);

      // Skip zero balances if hidden
      if (!showZeroBalances && balanceNum === 0) return;

      // Use structured metadata from the new BalanceData structure
      // The BlazeProvider now ensures all balance entries have enriched metadata
      const metadata = balanceEntry.metadata;

      const processedBalance: ProcessedTokenBalance = {
        token: {
          contractId: metadata.contractId,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          image: metadata.image,
          description: metadata.description,
          type: metadata.type
        },
        balance: balanceNum,
        formattedBalance: formatTokenAmount(balanceNum, metadata.decimals),
        isSubnet: metadata.type === 'SUBNET',
        hasSubnetBalance: !!balanceEntry.subnetBalance,
        subnetBalance: balanceEntry.subnetBalance ? Number(balanceEntry.subnetBalance) : undefined,
        formattedSubnetBalance: balanceEntry.formattedSubnetBalance ? balanceEntry.formattedSubnetBalance.toString() : undefined,
        isLPToken: !!(metadata.tokenAContract && metadata.tokenBContract),
        lpTokenInfo: metadata.tokenAContract && metadata.tokenBContract ? {
          tokenAContract: metadata.tokenAContract,
          tokenBContract: metadata.tokenBContract,
          rebatePercent: metadata.lpRebatePercent?.toString() || '0'
        } : undefined,
        // Price information now available directly
        priceData: {
          price: metadata.price,
          change24h: metadata.change24h,
          marketCap: metadata.marketCap
        }
      };

      balanceData.push(processedBalance);
    });

    // Sort based on selected criteria
    return balanceData.sort((a, b) => {
      switch (sortBy) {
        case 'value': {
          // When sorting by value, put excluded tokens at the bottom
          const aExcluded = excludedTokens.has(a.token.contractId);
          const bExcluded = excludedTokens.has(b.token.contractId);
          
          if (aExcluded !== bExcluded) {
            return aExcluded ? 1 : -1; // Excluded tokens go to bottom
          }
          
          // Sort by USD value (descending)
          const aValue = a.priceData?.price ? (a.balance / Math.pow(10, a.token.decimals)) * a.priceData.price : 0;
          const bValue = b.priceData?.price ? (b.balance / Math.pow(10, b.token.decimals)) * b.priceData.price : 0;
          if (aValue !== bValue) {
            return bValue - aValue;
          }
          break;
        }
        case 'balance': {
          // Sort by token balance (descending)
          if (a.balance !== b.balance) {
            return b.balance - a.balance;
          }
          break;
        }
        case 'symbol': {
          // Sort by symbol (ascending)
          const symbolCompare = a.token.symbol.localeCompare(b.token.symbol);
          if (symbolCompare !== 0) {
            return symbolCompare;
          }
          break;
        }
        case 'change24h': {
          // Sort by 24h change (descending)
          const aChange = a.priceData?.change24h ?? -Infinity;
          const bChange = b.priceData?.change24h ?? -Infinity;
          if (aChange !== bChange) {
            return bChange - aChange;
          }
          break;
        }
      }
      
      // Secondary sort by symbol
      return a.token.symbol.localeCompare(b.token.symbol);
    });
  }, [balances, showZeroBalances, sortBy, excludedTokens]);

  // Portfolio value and change calculations
  const portfolioStats = useMemo(() => {
    const stats = {
      totalValue: 0,
      change24hUsd: 0,
      change24hPercent: 0,
      change7dUsd: 0,
      change7dPercent: 0,
      tokensWithBalance: 0,
      tokensWithPrice: 0,
      totalTokens: tokenBalances.length
    };

    // Calculate aggregated portfolio metrics
    for (const token of tokenBalances) {
      if (token.balance > 0) {
        stats.tokensWithBalance++;

        if (token.priceData?.price !== null && token.priceData?.price !== undefined) {
          stats.tokensWithPrice++;

          // Only include in portfolio calculations if not excluded
          if (!excludedTokens.has(token.token.contractId)) {
            // Calculate USD value for this token
            const tokenValueUsd = (token.balance / Math.pow(10, token.token.decimals)) * token.priceData.price;
            stats.totalValue += tokenValueUsd;

            // Calculate 24h change contribution
            if (token.priceData.change24h !== null && token.priceData.change24h !== undefined) {
              const change24hUsd = tokenValueUsd * (token.priceData.change24h / 100);
              stats.change24hUsd += change24hUsd;
            }

            // Calculate 7d change contribution (using change7d if available)
            if (token.token.type !== 'SUBNET' && token.priceData?.price && typeof (token.priceData as any).change7d === 'number') {
              const change7dUsd = tokenValueUsd * (((token.priceData as any).change7d || 0) / 100);
              stats.change7dUsd += change7dUsd;
            }
          }
        }
      }
    }

    // Calculate percentage changes
    const previousValue24h = stats.totalValue - stats.change24hUsd;
    if (previousValue24h > 0) {
      stats.change24hPercent = (stats.change24hUsd / previousValue24h) * 100;
    }

    const previousValue7d = stats.totalValue - stats.change7dUsd;
    if (previousValue7d > 0) {
      stats.change7dPercent = (stats.change7dUsd / previousValue7d) * 100;
    }

    return stats;
  }, [tokenBalances, excludedTokens]);

  // Utility function to format USD amounts
  const formatUsdAmount = (amount: number): string => {
    if (amount === 0) return '$0.00';
    if (Math.abs(amount) < 0.01) return amount >= 0 ? '<$0.01' : '>-$0.01';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Utility function to format percentage changes
  const formatPercentChange = (percent: number): string => {
    if (percent === 0) return '0.00%';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm text-white/60">Portfolio Value</div>
              <div className="text-xl font-semibold text-white/90">
                {portfolioStats.tokensWithPrice > 0 ? formatUsdAmount(portfolioStats.totalValue) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* 24h Change */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${portfolioStats.change24hUsd >= 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
              }`}>
              {portfolioStats.change24hUsd >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="text-sm text-white/60">24h Change</div>
              <div className={`text-xl font-semibold ${portfolioStats.change24hUsd >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                {portfolioStats.tokensWithPrice > 0 ? (
                  <>
                    <div>{formatUsdAmount(portfolioStats.change24hUsd)}</div>
                    <div className="text-xs opacity-80">{formatPercentChange(portfolioStats.change24hPercent)}</div>
                  </>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 7d Change */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${portfolioStats.change7dUsd >= 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
              }`}>
              {portfolioStats.change7dUsd >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="text-sm text-white/60">7d Change</div>
              <div className={`text-xl font-semibold ${portfolioStats.change7dUsd >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                {portfolioStats.tokensWithPrice > 0 ? (
                  <>
                    <div>{formatUsdAmount(portfolioStats.change7dUsd)}</div>
                    <div className="text-xs opacity-80">{formatPercentChange(portfolioStats.change7dPercent)}</div>
                  </>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm text-white/60">Portfolio</div>
              <div className="text-xl font-semibold text-white/90">
                <div>{portfolioStats.tokensWithBalance} tokens</div>
                <div className="text-xs text-white/50">
                  {portfolioStats.tokensWithPrice} with prices
                  {excludedTokens.size > 0 && (
                    <span className="text-orange-400"> • {excludedTokens.size} excluded</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-white/90">Token Balances</h3>
        
        <div className="flex items-center gap-3">
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-white/60" />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-[160px] bg-white/[0.05] border-white/[0.08] text-white/90 hover:bg-white/[0.08] focus:ring-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/[0.08] text-white/90">
                <SelectItem value="value">Sort by Value</SelectItem>
                <SelectItem value="balance">Sort by Balance</SelectItem>
                <SelectItem value="symbol">Sort by Symbol</SelectItem>
                <SelectItem value="change24h">Sort by 24h Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Zero Balance Toggle */}
          <button
            onClick={() => setShowZeroBalances(!showZeroBalances)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-white/70 hover:text-white/90"
          >
            {showZeroBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm">
              {showZeroBalances ? 'Hide Zero Balances' : 'Show Zero Balances'}
            </span>
          </button>
        </div>
      </div>

      {/* Token Balance List */}
      <div className="space-y-2">
        {tokenBalances.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-4 mx-auto">
              <Wallet className="w-8 h-8 text-white/40" />
            </div>
            <p className="text-white/60">No tokens to display</p>
            <p className="text-white/40 text-sm mt-1">
              {showZeroBalances ? 'No tokens found in your wallet' : 'Enable "Show Zero Balances" to see all tokens'}
            </p>
          </div>
        ) : (
          tokenBalances.map((item, index) => {
            const isExcluded = excludedTokens.has(item.token.contractId);
            const hasPrice = item.priceData?.price !== null && item.priceData?.price !== undefined;

            return (
              <div
                key={`${item.token.contractId}-${index}`}
                className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-200 ${isExcluded
                    ? 'bg-red-500/[0.05] border-red-500/20 opacity-75'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  } ${hasPrice && item.balance > 0 ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (hasPrice && item.balance > 0) {
                    toggleTokenExclusion(item.token.contractId);
                  }
                }}
                title={hasPrice && item.balance > 0 ?
                  (isExcluded ? 'Click to include in portfolio calculations' : 'Click to exclude from portfolio calculations')
                  : 'No price data available'
                }
              >
                <div className="flex items-center gap-3">
                  <TokenLogo
                    token={item.token as TokenCacheData}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white/90">{item.token.symbol}</span>
                      {item.isSubnet && (
                        <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                          SUBNET
                        </span>
                      )}
                      {isExcluded && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded border border-red-500/30 flex items-center gap-1">
                          <X className="w-3 h-3" />
                          EXCLUDED
                        </span>
                      )}

                      {/* Navigation Links */}
                      <div className="flex items-center gap-1 ml-auto">
                        {/* Token Detail Page Link */}
                        <a
                          href={`/tokens/${encodeURIComponent(item.token.contractId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                          title="View token details"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        {/* Prices Detail Page Link */}
                        <a
                          href={`https://invest.charisma.rocks/prices/${encodeURIComponent(item.token.contractId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors"
                          title="View price analytics"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BarChart3 className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="text-sm text-white/60 truncate">
                      {item.token.name}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-medium text-white/90">
                    {item.formattedBalance}
                  </div>
                  {item.priceData?.price && item.balance > 0 && (
                    <div className={`text-xs ${isExcluded ? 'text-white/40 line-through' : 'text-green-400'}`}>
                      ${(item.balance * item.priceData.price / Math.pow(10, item.token.decimals)).toFixed(2)} USD
                    </div>
                  )}
                  {item.priceData?.change24h && (
                    <div className={`text-xs ${isExcluded
                        ? 'text-white/40'
                        : item.priceData.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                      {item.priceData.change24h >= 0 ? '+' : ''}{item.priceData.change24h.toFixed(2)}%
                    </div>
                  )}
                  <div className="text-xs text-white/50 font-mono">
                    {item.token.contractId.split('.')[1] || 'native'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Wallet Address Info */}
      <div className="mt-8 p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="text-sm text-white/60 mb-2">Connected Wallet</div>
        <div className="font-mono text-sm text-white/80 break-all">
          {walletAddress}
        </div>
      </div>

      {/* Debug Section (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-red-500/[0.05] border border-red-500/20 rounded-lg">
          <button
            onClick={() => setDebugExpanded(!debugExpanded)}
            className="flex items-center gap-2 mb-3 w-full text-left hover:bg-red-500/[0.05] rounded-md p-2 -m-2 transition-colors"
          >
            <div className="w-4 h-4 bg-red-500/30 rounded text-red-400 flex items-center justify-center text-xs">
              🐛
            </div>
            <div className="text-sm font-medium text-red-300 flex-1">Debug: Raw useBlaze balances</div>
            {debugExpanded ? (
              <ChevronDown className="w-4 h-4 text-red-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-red-400" />
            )}
          </button>

          {debugExpanded && (
            <div className="bg-black/20 rounded-lg p-3 overflow-auto max-h-96">
              <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap">
                {JSON.stringify(balances, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}