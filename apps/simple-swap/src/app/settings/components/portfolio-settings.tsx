'use client';

import React, { useState, useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { usePrices } from '@/contexts/token-price-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Eye,
  Info,
  Activity,
  DollarSign,
  Hash,
  Clock,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { formatCompactNumber } from '@/lib/swap-utils';
import TokenLogo from '@/components/TokenLogo';
import { TokenCacheData } from '@repo/tokens';
import { Label } from '@/components/ui/label';
import BatchWalletImportDialog from '@/components/portfolio/BatchWalletImportDialog';

interface TokenBalanceData {
  contractId: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  balance: string;
  formattedBalance: number;
  subnetBalance?: number;
  formattedSubnetBalance?: number;
  subnetContractId?: string;
  mainnetUsdValue: number;
  subnetUsdValue: number;
  totalUsdValue: number;
  price?: number;
  hasMainnet: boolean;
  hasSubnet: boolean;
  metadata?: any;
  image?: string;
}

// Helper function to convert TokenBalanceData to TokenCacheData for TokenLogo
const createTokenCacheData = (token: TokenBalanceData): TokenCacheData => ({
  contractId: token.contractId,
  name: token.name || 'Unknown Token',
  symbol: token.symbol || 'TKN',
  decimals: token.decimals || 6,
  image: token.image || token.metadata?.image || '',
  type: token.hasSubnet ? 'SUBNET' : 'MAINNET',
  identifier: token.metadata?.identifier || ''
});

export default function PortfolioSettings() {
  const { address, connected, watchedAddresses, addWatchedAddresses, privacyMode, togglePrivacyMode } = useWallet();
  
  // Get data from new contexts
  const { prices, getPrice, isLoading: pricesLoading, lastUpdate: pricesLastUpdate } = usePrices();
  const { balances, isLoading: balancesLoading, getBalance, lastUpdate: balancesLastUpdate } = useBalances([address, ...watchedAddresses].filter(Boolean));
  const { getTokenSymbol, getTokenName, getTokenImage, getTokenDecimals, isLoading: metadataLoading, lastUpdate: metadataLastUpdate } = useTokenMetadata();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenBalanceData | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [sortBy, setSortBy] = useState<'value' | 'balance' | 'name'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [debugSearchTerm, setDebugSearchTerm] = useState('');
  const [hideZeroBalances, setHideZeroBalances] = useState(true);
  const [hideDustAmounts, setHideDustAmounts] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  
  // Define dust threshold (tokens worth less than $0.01)
  const DUST_THRESHOLD = 0.01;

  // Get all wallet addresses to track
  const allWallets = [address, ...watchedAddresses].filter(Boolean);
  
  // Process balances for all wallets
  const portfolioData = useMemo(() => {
    if (!address && watchedAddresses.length === 0) return { tokens: [], totalValue: 0, walletBreakdown: {} };
    
    const tokens: TokenBalanceData[] = [];
    let totalValue = 0;
    const walletBreakdown: Record<string, { tokens: TokenBalanceData[], totalValue: number }> = {};
    const allWallets = [address, ...watchedAddresses].filter(Boolean);

    // Initialize wallet breakdown
    allWallets.forEach(walletAddr => {
      if (walletAddr) {
        walletBreakdown[walletAddr] = { tokens: [], totalValue: 0 };
      }
    });

    // Process each wallet's balances
    allWallets.forEach(walletAddr => {
      if (!walletAddr) return;
      
      const walletBalances = getBalance(walletAddr);
      if (!walletBalances) return;
      
      Object.entries(walletBalances.fungible_tokens || {}).forEach(([contractId, balanceData]) => {
        const price = getPrice(contractId) || 0;
        const rawBalance = parseFloat(balanceData.balance || '0');
        
        // Skip zero balances
        if (rawBalance === 0) return;
        
        // Calculate formatted balance using token decimals
        const decimals = getTokenDecimals(contractId);
        const formattedBalance = rawBalance / Math.pow(10, decimals);
        const totalTokenValue = formattedBalance * price;
        
        const tokenData: TokenBalanceData = {
          contractId,
          name: getTokenName(contractId),
          symbol: getTokenSymbol(contractId),
          decimals,
          balance: balanceData.balance,
          formattedBalance,
          subnetBalance: undefined, // No subnet support in new structure
          formattedSubnetBalance: undefined,
          subnetContractId: undefined,
          mainnetUsdValue: totalTokenValue,
          subnetUsdValue: 0,
          totalUsdValue: totalTokenValue,
          price,
          hasMainnet: formattedBalance > 0,
          hasSubnet: false,
          metadata: balanceData,
          image: getTokenImage(contractId) || undefined
        };

        // Add to wallet-specific breakdown
        walletBreakdown[walletAddr].tokens.push(tokenData);
        walletBreakdown[walletAddr].totalValue += totalTokenValue;

        // Add to combined view (only if not already added from another wallet)
        const existingToken = tokens.find(t => t.contractId === contractId);
        if (existingToken) {
          // Aggregate balances for combined view
          existingToken.formattedBalance += formattedBalance;
          existingToken.mainnetUsdValue += totalTokenValue;
          existingToken.totalUsdValue += totalTokenValue;
          existingToken.hasMainnet = existingToken.hasMainnet || formattedBalance > 0;
        } else {
          tokens.push({ ...tokenData });
        }
        
        totalValue += totalTokenValue;
      });
    });

    // Sort tokens based on selected criteria
    const sortTokens = (tokensToSort: TokenBalanceData[]) => {
      return tokensToSort.sort((a, b) => {
        let aValue: number | string = 0;
        let bValue: number | string = 0;

        switch (sortBy) {
          case 'value':
            aValue = a.totalUsdValue;
            bValue = b.totalUsdValue;
            break;
          case 'balance':
            aValue = a.formattedBalance + (a.formattedSubnetBalance || 0);
            bValue = b.formattedBalance + (b.formattedSubnetBalance || 0);
            break;
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
        }

        if (typeof aValue === 'string') {
          return sortOrder === 'desc'
            ? bValue.toString().localeCompare(aValue.toString())
            : aValue.toString().localeCompare(bValue.toString());
        }

        return sortOrder === 'desc' ? (bValue as number) - (aValue as number) : (aValue as number) - (bValue as number);
      });
    };

    // Sort tokens and wallet breakdown tokens
    sortTokens(tokens);
    Object.keys(walletBreakdown).forEach(walletAddr => {
      sortTokens(walletBreakdown[walletAddr].tokens);
    });

    return { tokens, totalValue, walletBreakdown };
  }, [address, watchedAddresses, balances, getBalance, getPrice, getTokenName, getTokenSymbol, getTokenImage, getTokenDecimals, sortBy, sortOrder]);

  // Get current wallet data and filter tokens
  const currentWalletData = useMemo(() => {
    if (selectedWallet === 'all') {
      return { tokens: portfolioData.tokens, totalValue: portfolioData.totalValue };
    } else {
      const walletData = portfolioData.walletBreakdown[selectedWallet];
      return walletData || { tokens: [], totalValue: 0 };
    }
  }, [selectedWallet, portfolioData]);

  // Filter tokens based on search and balance filters
  const filteredTokens = useMemo(() => {
    let filtered = currentWalletData.tokens;

    // Apply balance filters first
    if (hideZeroBalances) {
      filtered = filtered.filter(token => 
        token.formattedBalance > 0 || (token.formattedSubnetBalance && token.formattedSubnetBalance > 0)
      );
    }

    if (hideDustAmounts) {
      filtered = filtered.filter(token => token.totalUsdValue >= DUST_THRESHOLD);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(token =>
        token.name?.toLowerCase().includes(term) ||
        token.symbol?.toLowerCase().includes(term) ||
        token.contractId.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [currentWalletData.tokens, searchTerm, hideZeroBalances, hideDustAmounts, DUST_THRESHOLD]);

  // Filter debug balance data based on search
  const filteredDebugBalances = useMemo(() => {
    const userBalance = address ? getBalance(address) : null;
    if (!debugSearchTerm || !userBalance) return userBalance?.fungible_tokens || {};
    
    const term = debugSearchTerm.toLowerCase();
    const filtered: Record<string, any> = {};
    
    Object.entries(userBalance.fungible_tokens || {}).forEach(([contractId, balanceData]) => {
      const tokenName = getTokenName(contractId);
      const tokenSymbol = getTokenSymbol(contractId);
      
      if (
        contractId.toLowerCase().includes(term) ||
        tokenName.toLowerCase().includes(term) ||
        tokenSymbol.toLowerCase().includes(term)
      ) {
        filtered[contractId] = balanceData;
      }
    });
    
    return filtered;
  }, [getBalance, address, debugSearchTerm, getTokenName, getTokenSymbol]);

  const formatCurrency = (value: number) => {
    if (privacyMode) {
      return '••••••';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: value < 0.01 ? 6 : 2,
      maximumFractionDigits: value < 0.01 ? 6 : 2,
    }).format(value);
  };

  const formatBalance = (balance: number, decimals?: number) => {
    if (privacyMode) {
      return '••••••';
    }
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals || 6
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatCompactBalance = (balance: number, symbol: string) => {
    if (privacyMode) {
      return '•••••• ' + symbol;
    }
    return formatCompactNumber(balance) + ' ' + symbol;
  };

  // Handle wallet import
  const handleImportWallets = async (addresses: string[]) => {
    try {
      await addWatchedAddresses(addresses);
    } catch (error) {
      console.error('Failed to import wallet addresses:', error);
      throw error; // Re-throw to let the dialog handle the error
    }
  };

  if (!connected || !address) {
    return (
      <div className="text-center py-8">
        <Wallet className="w-16 h-16 mx-auto mb-4 text-white/40" />
        <h3 className="text-xl font-medium text-white/90 mb-2">Wallet Not Connected</h3>
        <p className="text-white/60">
          Please connect your wallet to view your portfolio and token balances.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white/95 flex items-center">
                <Wallet className="w-5 h-5 mr-2" />
                Portfolio Overview
              </CardTitle>
              <CardDescription className="text-white/70">
                Real-time portfolio analytics with live price updates
              </CardDescription>
            </div>
            
            {/* Wallet Selector */}
            {(watchedAddresses.length > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/60">View:</span>
                <Select value={selectedWallet} onValueChange={setSelectedWallet}>
                  <SelectTrigger className="w-48 bg-white/[0.05] border-white/[0.10] text-white/90">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border">
                    <SelectItem value="all">All Wallets Combined</SelectItem>
                    {address && (
                      <SelectItem value={address}>
                        Connected Wallet ({address.slice(0, 8)}...{address.slice(-4)})
                      </SelectItem>
                    )}
                    {watchedAddresses.map((addr, index) => (
                      <SelectItem key={addr} value={addr}>
                        Watched #{index + 1} ({addr.slice(0, 8)}...{addr.slice(-4)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {balancesLoading && (
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-blue-200 font-medium mb-1">Loading Portfolio Data</h4>
                  <p className="text-blue-200/70 text-sm">
                    Fetching token balances and price data from blockchain...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white/[0.03] rounded-xl p-3 sm:p-4 border border-white/[0.08]">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-white/60 text-xs sm:text-sm">Total Value</p>
                  <p className="text-xl sm:text-2xl font-bold text-white/95 truncate">
                    {formatCurrency(currentWalletData.totalValue)}
                  </p>
                </div>
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 flex-shrink-0" />
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-xl p-3 sm:p-4 border border-white/[0.08]">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-white/60 text-xs sm:text-sm">Total Tokens</p>
                  <p className="text-xl sm:text-2xl font-bold text-white/95">
                    {currentWalletData.tokens.length}
                  </p>
                </div>
                <Hash className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0" />
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-xl p-3 sm:p-4 border border-white/[0.08] sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-white/60 text-xs sm:text-sm">Data Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${!balancesLoading && !pricesLoading && !metadataLoading ? 'bg-green-400' : 'bg-yellow-400'}`} />
                    <p className="text-white/95 font-medium text-sm sm:text-base">
                      {!balancesLoading && !pricesLoading && !metadataLoading ? 'Updated' : 'Loading'}
                    </p>
                  </div>
                </div>
                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 flex-shrink-0" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="text-xs sm:text-sm text-white/60">
              Last updated: {formatDate(Math.max(pricesLastUpdate, balancesLastUpdate, metadataLastUpdate))}
            </div>
            <div className="flex flex-wrap gap-2">
              <BatchWalletImportDialog
                onImport={handleImportWallets}
                existingAddresses={watchedAddresses}
                maxAddresses={50}
              />
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
                className="border-white/20 text-white/70 hover:text-white/90"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                onClick={() => setShowDebugModal(true)}
                variant="outline"
                size="sm"
                className="border-white/20 text-white/70 hover:text-white/90"
              >
                <Info className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Debug Info</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watched Addresses */}
      {watchedAddresses.length > 0 && (
        <Card className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white/95 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Watched Addresses ({watchedAddresses.length})
            </CardTitle>
            <CardDescription className="text-white/70">
              Additional wallet addresses you're monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {watchedAddresses.map((addr, index) => (
                <div key={addr} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <code className="text-sm font-mono text-white/90">{addr}</code>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10">
                      Watching
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
        <CardContent className="p-4 mt-6">
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search tokens by name, symbol, or contract..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/[0.05] border-white/[0.10] text-white/90 placeholder:text-white/40"
              />
            </div>

            {/* Filters and Sort Controls */}
            <div className="space-y-3 sm:space-y-4">
              {/* Balance Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideZeroBalances}
                      onChange={(e) => setHideZeroBalances(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-xs sm:text-sm text-white/70">Hide zero balances</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideDustAmounts}
                      onChange={(e) => setHideDustAmounts(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-xs sm:text-sm text-white/70">Hide dust (&lt;$0.01)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyMode}
                      onChange={(e) => togglePrivacyMode()}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-xs sm:text-sm text-white/70">Privacy mode</span>
                  </label>
                </div>
              </div>
              
              {/* Sort Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-xs text-white/60 font-medium">Sort by:</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'value') {
                        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortBy('value');
                        setSortOrder('desc');
                      }
                    }}
                    className={`border-white/20 text-white/70 hover:text-white/90 transition-all duration-200 ${sortBy === 'value' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : ''
                      }`}
                  >
                    Value
                    {sortBy === 'value' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />
                    )}
                    {sortBy !== 'value' && <ArrowUpDown className="w-3 h-3 ml-1" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'balance') {
                        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortBy('balance');
                        setSortOrder('desc');
                      }
                    }}
                    className={`border-white/20 text-white/70 hover:text-white/90 transition-all duration-200 ${sortBy === 'balance' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : ''
                      }`}
                  >
                    Balance
                    {sortBy === 'balance' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />
                    )}
                    {sortBy !== 'balance' && <ArrowUpDown className="w-3 h-3 ml-1" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                    }}
                    className={`border-white/20 text-white/70 hover:text-white/90 transition-all duration-200 ${sortBy === 'name' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : ''
                      }`}
                  >
                    Name
                    {sortBy === 'name' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />
                    )}
                    {sortBy !== 'name' && <ArrowUpDown className="w-3 h-3 ml-1" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Balances */}
      <Card className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white/95 flex items-center">
                <Hash className="w-5 h-5 mr-2" />
                Token Balances
                {selectedWallet !== 'all' && (
                  <span className="ml-2 text-sm font-normal text-white/60">
                    ({selectedWallet.slice(0, 8)}...{selectedWallet.slice(-4)})
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-white/70">
                {selectedWallet === 'all' 
                  ? 'Combined token holdings from all wallets with real-time prices'
                  : 'Token holdings with real-time prices and values'
                }
              </CardDescription>
            </div>
            {filteredTokens.length > 0 && (
              <Badge variant="outline" className="border-white/20 text-white/70">
                {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
                {(hideZeroBalances || hideDustAmounts || searchTerm) && 
                  ` (${currentWalletData.tokens.length} total)`
                }
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredTokens.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto mb-6">
                <Wallet className="w-10 h-10 text-white/40" />
              </div>
              <h3 className="text-lg font-medium text-white/90 mb-2">
                {searchTerm ? 'No matching tokens' : 'No token balances'}
              </h3>
              <p className="text-white/60 max-w-md mx-auto">
                {searchTerm ? 'Try adjusting your search terms or clearing the search filter.' : 'Once you have token balances, they will appear here with real-time pricing.'}
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto max-w-[275px] sm:max-w-none" style={{ minHeight: '400px' }}>
              <div className="space-y-2 pr-2">
                {filteredTokens.map((token, index) => (
                  <div
                    key={token.contractId}
                    className="group p-4 bg-white/[0.02] rounded-xl border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200 cursor-pointer"
                    onClick={() => setSelectedToken(token)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <TokenLogo
                          token={createTokenCacheData(token)}
                          size="lg"
                          className="transition-all duration-200 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white/95 group-hover:text-white transition-colors duration-200 truncate">
                            {token.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-white/60 group-hover:text-white/70 transition-colors duration-200">
                              {token.symbol}
                            </p>
                            <div className="flex items-center gap-1">
                              {token.hasMainnet && (
                                <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10 px-1.5 py-0.5">
                                  Main
                                </Badge>
                              )}
                              {token.hasSubnet && (
                                <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400 bg-purple-500/10 px-1.5 py-0.5">
                                  <Zap className="w-2.5 h-2.5 mr-0.5" />
                                  Sub
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-white/95 group-hover:text-white transition-colors duration-200 text-sm sm:text-base">
                          {formatCurrency(token.totalUsdValue)}
                        </p>
                        <div className="text-xs sm:text-sm text-white/60 group-hover:text-white/70 transition-colors duration-200 space-y-0.5 mt-1">
                          {token.hasMainnet && (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-blue-400">Main:</span>
                              <span className="truncate max-w-20 sm:max-w-none">{formatCompactBalance(token.formattedBalance, token.symbol || 'TKN')}</span>
                            </div>
                          )}
                          {token.hasSubnet && (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-purple-400">Sub:</span>
                              <span className="truncate max-w-20 sm:max-w-none">{formatCompactBalance(token.formattedSubnetBalance || 0, token.symbol || 'TKN')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Detail Modal */}
      {selectedToken && (
        <Dialog open={!!selectedToken} onOpenChange={() => setSelectedToken(null)}>
          <DialogContent className="bg-background border border-border backdrop-blur-xl max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center">
                <div className="mr-3">
                  <TokenLogo
                    token={createTokenCacheData(selectedToken)}
                    size="md"
                  />
                </div>
                {selectedToken.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Detailed information about this token
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Symbol</p>
                  <p className="font-mono text-foreground">{selectedToken.symbol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Decimals</p>
                  <p className="font-mono text-foreground">{selectedToken.decimals}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <p className="font-mono text-foreground">{new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: (selectedToken.price || 0) < 0.01 ? 6 : 2,
                    maximumFractionDigits: (selectedToken.price || 0) < 0.01 ? 6 : 2,
                  }).format(selectedToken.price || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="font-mono text-foreground">{formatCurrency(selectedToken.totalUsdValue)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Contract ID</p>
                <code className="block p-2 bg-muted rounded text-sm font-mono break-all">
                  {selectedToken.contractId}
                </code>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Balance Breakdown</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedToken.hasMainnet && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full" />
                          <p className="text-sm font-medium text-blue-400">Mainnet Balance</p>
                        </div>
                        <p className="font-mono text-foreground text-lg">
                          {formatCompactBalance(selectedToken.formattedBalance, selectedToken.symbol || 'TKN')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(selectedToken.mainnetUsdValue)}
                        </p>
                      </div>
                    )}
                    {selectedToken.hasSubnet && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-3 h-3 text-purple-400" />
                          <p className="text-sm font-medium text-purple-400">Subnet Balance</p>
                        </div>
                        <p className="font-mono text-foreground text-lg">
                          {formatCompactBalance(selectedToken.formattedSubnetBalance || 0, selectedToken.symbol || 'TKN')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(selectedToken.subnetUsdValue)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Token Availability</p>
                  <div className="flex items-center gap-3 mt-1">
                    {selectedToken.hasMainnet && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full" />
                        <span className="text-sm text-foreground">Mainnet</span>
                      </div>
                    )}
                    {selectedToken.hasSubnet && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-purple-400" />
                        <span className="text-sm text-foreground">Subnet</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Debug Modal */}
      <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
        <DialogContent className="bg-background border border-border backdrop-blur-xl max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center">
              <Info className="w-5 h-5 mr-2" />
              Debug Information
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Technical details about the portfolio data and context connections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Search for debug data */}
            <div>
              <h4 className="font-semibold text-foreground mb-2">Search Balance Data</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by contract name, symbol, or ID..."
                  value={debugSearchTerm}
                  onChange={(e) => setDebugSearchTerm(e.target.value)}
                  className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Connection Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Balances Loading</p>
                  <p className="font-mono text-foreground">{balancesLoading ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prices Loading</p>
                  <p className="font-mono text-foreground">{pricesLoading ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Metadata Loading</p>
                  <p className="font-mono text-foreground">{metadataLoading ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Wallet Connected</p>
                  <p className="font-mono text-foreground">{connected ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-mono text-foreground text-xs">{address || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Balances Update</p>
                  <p className="font-mono text-foreground">{formatDate(balancesLastUpdate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Prices Update</p>
                  <p className="font-mono text-foreground">{formatDate(pricesLastUpdate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Metadata Update</p>
                  <p className="font-mono text-foreground">{formatDate(metadataLastUpdate)}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Data Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Balances</p>
                  <p className="font-mono text-foreground">{Object.keys(balances).length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Prices</p>
                  <p className="font-mono text-foreground">{Object.keys(prices).length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">User Address</p>
                  <p className="font-mono text-foreground">{address?.slice(0, 8)}...{address?.slice(-8)}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">
                Raw Balance Data
                {debugSearchTerm && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({Object.keys(filteredDebugBalances).length} matches)
                  </span>
                )}
              </h4>
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(filteredDebugBalances, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}