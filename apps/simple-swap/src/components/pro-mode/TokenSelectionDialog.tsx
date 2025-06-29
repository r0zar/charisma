import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, X, Wallet, Flame } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import TokenLogo from '../TokenLogo';
import { TokenCacheData } from '@repo/tokens';
import { getTokenBalance } from '../../app/actions';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useWallet } from '@/contexts/wallet-context';
import { useBlaze } from 'blaze-sdk';

interface TokenSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectionType: 'from' | 'to' | 'tradingPairBase' | 'tradingPairQuote';
    title: string;
}

export default function TokenSelectionDialog({
    isOpen,
    onClose,
    selectionType,
    title
}: TokenSelectionDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [tokenBalances, setTokenBalances] = useState<Map<string, number>>(new Map());
    const [loadingBalances, setLoadingBalances] = useState<Set<string>>(new Set());

    const {
        selectedOrderType,
        setTradingPairBase,
        setTradingPairQuote,
        tradingPairBase,
        tradingPairQuote,
        formatCompactPrice,
        getTokenPrice
    } = useProModeContext();

    const {
        displayTokens,
        subnetDisplayTokens,
        selectedFromToken,
        selectedToToken,
        setSelectedFromTokenSafe,
        setSelectedToToken,
        setConditionToken,
        tokenCounterparts
    } = useSwapTokens() as any;

    const { address: userAddress } = useWallet();

    const { getPrice } = useBlaze();

    // Determine which tokens to show based on selection type
    const availableTokens = useMemo(() => {
        // For 'from' token selection, only show subnet tokens
        if (selectionType === 'from') {
            return subnetDisplayTokens || [];
        }
        // For 'to' token selection in sandwich mode, also only show subnet tokens
        if (selectionType === 'to' && selectedOrderType === 'sandwich') {
            return subnetDisplayTokens || [];
        }
        // For all other selections, show all tokens
        return displayTokens || [];
    }, [selectionType, selectedOrderType, subnetDisplayTokens, displayTokens]);

    // Filter tokens based on search query
    const filteredTokens = useMemo(() => {
        if (!searchQuery.trim()) return availableTokens;

        const query = searchQuery.toLowerCase();
        return availableTokens.filter((token: any) =>
            token.symbol.toLowerCase().includes(query) ||
            token.name.toLowerCase().includes(query) ||
            token.contractId.toLowerCase().includes(query)
        );
    }, [availableTokens, searchQuery]);

    // Handle token selection
    const handleTokenSelect = (token: TokenCacheData) => {
        switch (selectionType) {
            case 'from':
                setSelectedFromTokenSafe(token);
                setConditionToken(token);
                // Auto-set trading pair if not already set
                if (!tradingPairBase) {
                    setTradingPairBase(token);
                }
                break;
            case 'to':
                setSelectedToToken(token);
                break;
            case 'tradingPairBase':
                setTradingPairBase(token);
                break;
            case 'tradingPairQuote':
                setTradingPairQuote(token);
                break;
        }
        onClose();
    };

    // Get current selection for highlighting
    const getCurrentSelection = () => {
        switch (selectionType) {
            case 'from':
                return selectedFromToken;
            case 'to':
                return selectedToToken;
            case 'tradingPairBase':
                return tradingPairBase;
            case 'tradingPairQuote':
                return tradingPairQuote;
            default:
                return null;
        }
    };

    const currentSelection = getCurrentSelection();

    // Helper function to format token balance with dynamic precision
    const formatTokenBalance = (balance: number, token: TokenCacheData): string => {
        const decimals = token.decimals || 6;

        if (balance === 0) return '0';
        if (balance < 0.001) {
            return balance.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(decimals, 10)
            });
        } else if (balance < 1) {
            return balance.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(decimals, 6)
            });
        } else {
            return balance.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(decimals, 4)
            });
        }
    };

    // Function to fetch token balance
    const fetchTokenBalance = async (token: TokenCacheData) => {
        if (!userAddress || loadingBalances.has(token.contractId)) return;

        setLoadingBalances(prev => new Set(prev).add(token.contractId));

        try {
            const balance = await getTokenBalance(token.contractId, userAddress);
            const humanReadableBalance = balance / Math.pow(10, token.decimals || 6);

            setTokenBalances(prev => new Map(prev).set(token.contractId, humanReadableBalance));
        } catch (error) {
            console.error(`Error fetching balance for ${token.contractId}:`, error);
            setTokenBalances(prev => new Map(prev).set(token.contractId, 0));
        } finally {
            setLoadingBalances(prev => {
                const newSet = new Set(prev);
                newSet.delete(token.contractId);
                return newSet;
            });
        }
    };

    // Fetch balances for visible tokens
    useEffect(() => {
        if (!userAddress || !isOpen) return;

        // Fetch balances for filtered tokens (limit to first 20 to avoid too many requests)
        const tokensToFetch = filteredTokens.slice(0, 20);
        tokensToFetch.forEach((token: any) => {
            if (!tokenBalances.has(token.contractId) && !loadingBalances.has(token.contractId)) {
                fetchTokenBalance(token);
            }
        });
    }, [filteredTokens, userAddress, isOpen]);

    // Get balance for a specific token
    const getTokenBalanceDisplay = (token: TokenCacheData) => {
        const balance = tokenBalances.get(token.contractId);
        const isLoading = loadingBalances.has(token.contractId);

        if (!userAddress) return null;
        if (isLoading) return 'Loading...';
        if (balance === undefined) return null;

        return formatTokenBalance(balance, token);
    };

    // Format token price with dynamic precision
    const formatTokenPrice = (price: number): string => {
        if (price === 0) return '$0.00';
        if (price < 0.000001) {
            return price.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 12
            });
        } else if (price < 0.001) {
            return price.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 8
            });
        } else if (price < 1) {
            return price.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 6
            });
        } else {
            return price.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            });
        }
    };

    // Calculate total value (price × balance)
    const getTotalValue = (token: TokenCacheData) => {
        const balance = tokenBalances.get(token.contractId);
        const price = getPrice(token.contractId);

        if (!balance || !price || balance === 0) return null;

        const totalValue = balance * price;
        return totalValue.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // Get token counterparts (subnet/mainnet versions)
    const getTokenCounterparts = (token: TokenCacheData) => {
        if (!tokenCounterparts) return null;

        // For subnet tokens, look up by base token
        if (token.type === 'SUBNET' && token.base) {
            return tokenCounterparts.get(token.base);
        }
        // For mainnet tokens, look up by contract ID
        return tokenCounterparts.get(token.contractId);
    };

    // Check if token has counterparts
    const hasCounterparts = (token: TokenCacheData) => {
        const counterparts = getTokenCounterparts(token);
        return counterparts && (counterparts.subnet || counterparts.mainnet);
    };

    // Get the alternative token (subnet ↔ mainnet)
    const getAlternativeToken = (token: TokenCacheData) => {
        const counterparts = getTokenCounterparts(token);
        if (!counterparts) return null;

        if (token.type === 'SUBNET') {
            return counterparts.mainnet;
        } else {
            return counterparts.subnet;
        }
    };

    // Create display pairs for tokens (mainnet + subnet when available)
    const createTokenDisplayPairs = () => {
        const pairs: Array<{ mainnet: TokenCacheData | null; subnet: TokenCacheData | null }> = [];
        const processedTokens = new Set<string>();

        filteredTokens.forEach((token: any) => {
            if (processedTokens.has(token.contractId)) return;

            const counterparts = getTokenCounterparts(token);

            if (counterparts && (counterparts.mainnet || counterparts.subnet)) {
                // This token has counterparts
                const mainnetToken = token.type === 'SUBNET' ? counterparts.mainnet : token;
                const subnetToken = token.type === 'SUBNET' ? token : counterparts.subnet;

                pairs.push({
                    mainnet: mainnetToken || null,
                    subnet: subnetToken || null
                });

                // Mark both tokens as processed
                if (mainnetToken) processedTokens.add(mainnetToken.contractId);
                if (subnetToken) processedTokens.add(subnetToken.contractId);
            } else {
                // This token has no counterparts, show as single
                pairs.push({
                    mainnet: token.type !== 'SUBNET' ? token : null,
                    subnet: token.type === 'SUBNET' ? token : null
                });
                processedTokens.add(token.contractId);
            }
        });

        return pairs;
    };

    const tokenPairs = createTokenDisplayPairs();

    // Component for rendering connected combo button
    const TokenComboButton = ({ pair }: { pair: { mainnet: TokenCacheData | null; subnet: TokenCacheData | null } }) => {
        const mainnetSelected = pair.mainnet && currentSelection?.contractId === pair.mainnet.contractId;
        const subnetSelected = pair.subnet && currentSelection?.contractId === pair.subnet.contractId;

        // Use the available token for the center icon and name
        const displayToken = pair.mainnet || pair.subnet;
        if (!displayToken) return null;

        // Check if mainnet token should be disabled for 'from' selection or 'to' selection in sandwich mode
        const isMainnetDisabled = (selectionType === 'from' || (selectionType === 'to' && selectedOrderType === 'sandwich')) && pair.mainnet;

        const getTokenData = (token: TokenCacheData | null) => {
            if (!token) return null;
            return {
                price: getPrice(token.contractId),
                formattedPrice: getPrice(token.contractId) ? formatTokenPrice(getPrice(token.contractId)!) : null,
                balanceDisplay: getTokenBalanceDisplay(token),
                totalValue: getTotalValue(token),
                isLoadingBalance: loadingBalances.has(token.contractId)
            };
        };

        const mainnetData = getTokenData(pair.mainnet);
        const subnetData = getTokenData(pair.subnet);

        return (
            <div className="flex items-stretch relative">
                {/* Left Wing - Mainnet */}
                <button
                    onClick={() => pair.mainnet && !isMainnetDisabled && handleTokenSelect(pair.mainnet)}
                    disabled={Boolean(!pair.mainnet || isMainnetDisabled)}
                    className={`flex-1 p-2 border transition-all rounded-l-lg ${(!pair.mainnet || isMainnetDisabled)
                        ? 'bg-gray-100/50 dark:bg-gray-800/30 border-gray-300/50 dark:border-gray-600/50 cursor-not-allowed opacity-40'
                        : mainnetSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer'
                            : 'border-gray-400 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer bg-white dark:bg-gray-700 shadow-sm'
                        } border-r-0 z-10`}
                >
                    {pair.mainnet ? (
                        <div className="flex items-center justify-between h-full min-h-[2.5rem]">
                            {/* Left side - Token info */}
                            <div className="flex flex-col justify-center space-y-0.5 text-left min-w-0 flex-1">
                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    Mainnet
                                </div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {pair.mainnet.symbol}
                                </div>
                                {mainnetSelected && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        Selected
                                    </div>
                                )}
                            </div>

                            {/* Right side - Price and balance */}
                            <div className="flex flex-col justify-center space-y-0.5 text-right min-w-0 flex-1">
                                {mainnetData?.formattedPrice && (
                                    <div className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                        {mainnetData.formattedPrice}
                                    </div>
                                )}
                                {userAddress && (
                                    <>
                                        {mainnetData?.isLoadingBalance ? (
                                            <div className="text-xs text-muted-foreground">Loading...</div>
                                        ) : mainnetData?.balanceDisplay ? (
                                            <>
                                                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                                    <span className="truncate">{mainnetData.balanceDisplay}</span>
                                                    <Wallet className="h-2.5 w-2.5 flex-shrink-0" />
                                                </div>
                                                {mainnetData.totalValue && (
                                                    <div className="text-xs text-green-600 dark:text-green-400 font-medium truncate">
                                                        {mainnetData.totalValue}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">No balance</div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full min-h-[2.5rem]">
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                Not available
                            </div>
                        </div>
                    )}
                </button>

                {/* Center - Token Icon */}
                <div className="flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/30 border-t border-b border-gray-300 dark:border-gray-600 px-3 py-2 z-20 relative">
                    <div className="relative">
                        <TokenLogo
                            token={{ ...displayToken, image: displayToken.image ?? undefined }}
                            size="md"
                        />
                    </div>
                </div>

                {/* Right Wing - Subnet */}
                <button
                    onClick={() => pair.subnet && handleTokenSelect(pair.subnet)}
                    disabled={!pair.subnet}
                    className={`flex-1 p-2 border transition-all rounded-r-lg ${!pair.subnet
                        ? 'bg-gray-100/50 dark:bg-gray-800/30 border-gray-300/50 dark:border-gray-600/50 cursor-not-allowed opacity-40'
                        : subnetSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer'
                            : 'border-gray-400 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer bg-white dark:bg-gray-700 shadow-sm'
                        } border-l-0 z-10`}
                >
                    {pair.subnet ? (
                        <div className="flex items-center justify-between h-full min-h-[2.5rem]">
                            {/* Left side - Price and balance */}
                            <div className="flex flex-col justify-center space-y-0.5 text-left min-w-0 flex-1">
                                {subnetData?.formattedPrice && (
                                    <div className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                        {subnetData.formattedPrice}
                                    </div>
                                )}
                                {userAddress && (
                                    <>
                                        {subnetData?.isLoadingBalance ? (
                                            <div className="text-xs text-muted-foreground">Loading...</div>
                                        ) : subnetData?.balanceDisplay ? (
                                            <>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Wallet className="h-2.5 w-2.5 flex-shrink-0" />
                                                    <span className="truncate">{subnetData.balanceDisplay}</span>
                                                </div>
                                                {subnetData.totalValue && (
                                                    <div className="text-xs text-green-600 dark:text-green-400 font-medium truncate">
                                                        {subnetData.totalValue}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">No balance</div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Right side - Token info */}
                            <div className="flex flex-col justify-center space-y-0.5 text-right min-w-0 flex-1">
                                <div className="flex items-center justify-end gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                                    <Flame className="h-3 w-3" />
                                    <span>Subnet</span>
                                </div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {pair.subnet.symbol}
                                </div>
                                {subnetSelected && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        Selected
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full min-h-[2.5rem]">
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                Not available
                            </div>
                        </div>
                    )}
                </button>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle>{title}</DialogTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 w-8 p-0 hover:bg-muted"
                            title="Close"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                {/* Search Input */}
                <div className="flex-shrink-0 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                        placeholder="Search tokens by name, symbol, or contract..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Token List */}
                <div className="flex-1 overflow-y-auto">
                    {tokenPairs.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-gray-500">
                            {searchQuery ? 'No tokens found matching your search' : 'No tokens available'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tokenPairs.map((pair, index) => {
                                const displayToken = pair.mainnet || pair.subnet;
                                if (!displayToken) return null;

                                return (
                                    <TokenComboButton key={index} pair={pair} />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="flex-shrink-0 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectionType === 'from' && (
                            <span>Only subnet tokens are available for the input token. Mainnet tokens are disabled for limit and DCA orders.</span>
                        )}
                        {selectionType === 'to' && selectedOrderType === 'sandwich' && (
                            <span>Only subnet tokens are available for Token B in sandwich strategies. Both tokens must be subnet tokens for sandwich orders.</span>
                        )}
                        {selectionType !== 'from' && !(selectionType === 'to' && selectedOrderType === 'sandwich') && (
                            <span>Showing {tokenPairs.length} token groups of {availableTokens.length} total tokens</span>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 