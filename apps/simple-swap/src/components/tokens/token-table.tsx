"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { ArrowUpDown, Search, Flame, Wallet } from "lucide-react";
import Image from "next/image";
import type { TokenSummary } from "@/app/token-actions";
import { usePrices } from '@/contexts/token-price-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { formatCompactNumber } from '@/lib/swap-utils';
import { getIpfsUrl } from '@/lib/utils';

interface TokenTableProps {
    tokens: TokenSummary[];
    compareId: string | null;
}

type SortKey = "name" | "market_cap" | "price" | "change1h" | "change24h" | "change7d";

// Token Image component with error handling
function TokenImage({ token }: { token: TokenSummary }) {
    const [imageError, setImageError] = useState(false);

    if (!token.image || imageError) {
        return (
            <span className="text-xs font-semibold text-primary/80">
                {token.symbol.charAt(0)}
            </span>
        );
    }

    return (
        <Image
            src={getIpfsUrl(token.image)}
            alt={token.symbol}
            width={32}
            height={32}
            className="object-cover"
            onError={() => setImageError(true)}
        />
    );
}

// Enhanced Token Price Component with real-time updates
const TokenPriceCell = React.memo(function TokenPriceCell({ token }: { token: TokenSummary }) {
    const { getPrice } = usePrices();
    
    // Get real-time price or fallback to server price
    const realTimePrice = getPrice(token.contractId);
    const currentPrice = realTimePrice ?? token.price;
    const hasRealTimePrice = realTimePrice !== null;
    
    return (
        <div className="text-right font-medium">
            <div className={`${hasRealTimePrice ? 'text-green-600 dark:text-green-400' : ''}`}>
                {fmtPrice(currentPrice)}
            </div>
            {hasRealTimePrice && (
                <div className="text-[10px] text-green-600/80 dark:text-green-400/80">LIVE</div>
            )}
        </div>
    );
});

// Enhanced Token Balance Component with simplified subnet handling
const TokenBalanceCell = React.memo(function TokenBalanceCell({ token }: { token: TokenSummary }) {
    const { address } = useWallet();
    const { getTokenBalance, getSubnetBalance } = useBalances(address ? [address] : []);
    const { getToken } = useTokenMetadata();
    
    if (!address) return null;
    
    const mainnetBalance = getTokenBalance(address, token.contractId);
    
    // Find subnet version of this token
    const tokenMetadata = getToken(token.contractId);
    const allTokens = Object.values(useTokenMetadata().tokens);
    const subnetToken = allTokens.find(t => t.base === token.contractId && t.type === 'SUBNET');
    const subnetBalance = subnetToken ? getSubnetBalance(address, subnetToken.contractId) : 0;
    const hasSubnetSupport = !!subnetToken;
    
    // Only show if user has any balance
    if (mainnetBalance === 0 && subnetBalance === 0) return null;
    
    return (
        <div className="text-xs space-y-1">
            {mainnetBalance > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Wallet className="h-3 w-3" />
                    <span>{formatCompactNumber(mainnetBalance)}</span>
                </div>
            )}
            {hasSubnetSupport && subnetBalance > 0 && (
                <div className="flex items-center gap-1 text-red-500">
                    <Flame className="h-3 w-3" />
                    <span>{formatCompactNumber(subnetBalance)}</span>
                </div>
            )}
            {hasSubnetSupport && subnetBalance === 0 && mainnetBalance > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground/50">
                    <Flame className="h-2.5 w-2.5" />
                    <span className="text-[10px]">subnet ready</span>
                </div>
            )}
        </div>
    );
});

// Clean Apple/Tesla version with price update animation
const CleanTokenPriceCell = React.memo(function CleanTokenPriceCell({ token }: { token: TokenSummary }) {
    const { getPrice } = usePrices();
    const [isUpdating, setIsUpdating] = useState(false);
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    
    // Get real-time price or fallback to server price
    const realTimePrice = getPrice(token.contractId);
    const currentPrice = realTimePrice ?? token.price;
    const hasRealTimePrice = realTimePrice !== null;
    
    // Detect price changes and trigger animation
    useEffect(() => {
        if (currentPrice !== null && lastPrice !== null && currentPrice !== lastPrice) {
            setIsUpdating(true);
            const timer = setTimeout(() => setIsUpdating(false), 1000); // 1 second animation
            return () => clearTimeout(timer);
        }
        setLastPrice(currentPrice);
    }, [currentPrice, lastPrice]);
    
    const getPriceChangeColor = () => {
        if (!isUpdating) return 'text-white/90';
        
        // During update animation - subtle color hints
        if (currentPrice !== null && lastPrice !== null) {
            return currentPrice > lastPrice ? 'text-emerald-300' : currentPrice < lastPrice ? 'text-red-300' : 'text-white/90';
        }
        return 'text-white/90';
    };
    
    return (
        <div className="text-right">
            <div className={`font-mono transition-all duration-1000 ${getPriceChangeColor()} ${
                isUpdating ? 'transform scale-105 drop-shadow-sm' : ''
            }`}>
                {fmtPrice(currentPrice)}
            </div>
            {hasRealTimePrice && (
                <div className={`text-[10px] font-medium transition-all duration-1000 ${
                    isUpdating ? 'text-emerald-300' : 'text-emerald-400/60'
                }`}>
                    LIVE
                </div>
            )}
        </div>
    );
});

const CleanTokenBalanceCell = React.memo(function CleanTokenBalanceCell({ token }: { token: TokenSummary }) {
    const { address } = useWallet();
    const { getTokenBalance, getSubnetBalance } = useBalances(address ? [address] : []);
    const { getToken } = useTokenMetadata();
    
    if (!address) return null;
    
    const mainnetBalance = getTokenBalance(address, token.contractId);
    
    // Find subnet version of this token
    const allTokens = Object.values(useTokenMetadata().tokens);
    const subnetToken = allTokens.find(t => t.base === token.contractId && t.type === 'SUBNET');
    const subnetBalance = subnetToken ? getSubnetBalance(address, subnetToken.contractId) : 0;
    const hasSubnetSupport = !!subnetToken;
    
    // Only show if user has any balance
    if (mainnetBalance === 0 && subnetBalance === 0) return null;
    
    return (
        <div className="text-xs space-y-1">
            {mainnetBalance > 0 && (
                <div className="flex items-center gap-1 text-white/60">
                    <Wallet className="h-3 w-3" />
                    <span className="font-mono">{formatCompactNumber(mainnetBalance)}</span>
                </div>
            )}
            {hasSubnetSupport && subnetBalance > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                    <Flame className="h-3 w-3" />
                    <span className="font-mono">{formatCompactNumber(subnetBalance)}</span>
                </div>
            )}
            {hasSubnetSupport && subnetBalance === 0 && mainnetBalance > 0 && (
                <div className="flex items-center gap-1 text-white/30">
                    <Flame className="h-2.5 w-2.5" />
                    <span className="text-[10px]">L2 ready</span>
                </div>
            )}
        </div>
    );
});

// Skeleton cell component for comparison loading states
const SkeletonCell = React.memo(function SkeletonCell() {
    return (
        <div className="animate-pulse">
            <div className="h-4 bg-white/[0.06] rounded-lg" />
        </div>
    );
});

// Enhanced token row with subtle price update animation
interface EnhancedTokenRowProps {
    token: TokenSummary;
    showBalances: boolean;
    address: string | null;
    compareToken: TokenSummary | null;
    getMarketCap: (token: TokenSummary) => number | null;
    getPercentageChange: (tokenChange: number | null, compareTokenChange: number | null, mode?: 'absolute' | 'relative') => number | null;
    hasSubnetSupport: (token: TokenSummary) => boolean;
    isComparisonChanging: boolean;
}

const EnhancedTokenRow = React.memo(function EnhancedTokenRow({ 
    token, 
    showBalances, 
    address, 
    compareToken,
    getMarketCap,
    getPercentageChange,
    hasSubnetSupport,
    isComparisonChanging
}: EnhancedTokenRowProps) {
    const { getPrice } = usePrices();
    const [isRowUpdating, setIsRowUpdating] = useState(false);
    const [lastRowPrice, setLastRowPrice] = useState<number | null>(null);
    
    // Get current price for this row
    const realTimePrice = getPrice(token.contractId);
    const currentRowPrice = realTimePrice ?? token.price;
    
    // Detect price changes and trigger subtle row animation
    useEffect(() => {
        if (currentRowPrice !== null && lastRowPrice !== null && currentRowPrice !== lastRowPrice) {
            setIsRowUpdating(true);
            const timer = setTimeout(() => setIsRowUpdating(false), 800); // Slightly shorter than price cell
            return () => clearTimeout(timer);
        }
        setLastRowPrice(currentRowPrice);
    }, [currentRowPrice, lastRowPrice]);
    
    const getRowBorderColor = () => {
        if (!isRowUpdating) return 'border-white/[0.03]';
        
        // Subtle border pulse during price update
        if (currentRowPrice !== null && lastRowPrice !== null) {
            return currentRowPrice > lastRowPrice 
                ? 'border-emerald-400/20' 
                : currentRowPrice < lastRowPrice 
                ? 'border-red-400/20' 
                : 'border-emerald-400/20';
        }
        return 'border-emerald-400/20';
    };
    
    return (
        <tr
            className={`cursor-pointer transition-all duration-800 border-b ${getRowBorderColor()} ${
                isRowUpdating 
                    ? 'bg-white/[0.01] shadow-sm' 
                    : 'hover:bg-white/[0.02]'
            }`}
            onClick={() => {
                if (token.contractId && typeof token.contractId === 'string' && token.contractId.trim()) {
                    try {
                        window.location.href = `/tokens/${encodeURIComponent(token.contractId)}`;
                    } catch (error) {
                        console.error('Failed to navigate to token page:', error, token);
                    }
                } else {
                    console.warn('Invalid token contractId for navigation:', token);
                }
            }}
        >
            {/* Token */}
            <td className="p-4 flex items-center gap-3 sticky left-0 backdrop-blur-sm z-10 w-[14rem]">
                <div className="h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center overflow-hidden">
                    <TokenImage token={token} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="font-medium leading-tight truncate max-w-[10rem] text-white/90">{token.name}</div>
                    <div className="text-xs text-white/50 font-mono">{token.symbol}</div>
                </div>
            </td>
            {/* Market Cap */}
            <td className="p-4 text-right font-mono text-white/80">{fmtMarketCap(getMarketCap(token))}</td>
            {/* Price */}
            <td className="p-4">
                <CleanTokenPriceCell token={token} />
            </td>
            {/* Balance (conditional) */}
            {showBalances && address && (
                <td className="p-4">
                    <CleanTokenBalanceCell token={token} />
                </td>
            )}
            {/* 1h */}
            <td className="p-4 text-right font-mono">
                {isComparisonChanging ? (
                    <SkeletonCell />
                ) : (
                    <span className={getCleanDeltaColour(getPercentageChange(token.change1h ?? null, compareToken?.change1h ?? null, 'absolute'))}>
                        {fmtDelta(getPercentageChange(token.change1h ?? null, compareToken?.change1h ?? null, 'absolute'))}
                    </span>
                )}
            </td>
            {/* 24h */}
            <td className="p-4 text-right font-mono">
                {isComparisonChanging ? (
                    <SkeletonCell />
                ) : (
                    <span className={getCleanDeltaColour(getPercentageChange(token.change24h ?? null, compareToken?.change24h ?? null, 'absolute'))}>
                        {fmtDelta(getPercentageChange(token.change24h ?? null, compareToken?.change24h ?? null, 'absolute'))}
                    </span>
                )}
            </td>
            {/* 7d */}
            <td className="p-4 text-right font-mono">
                {isComparisonChanging ? (
                    <SkeletonCell />
                ) : (
                    <span className={getCleanDeltaColour(getPercentageChange(token.change7d ?? null, compareToken?.change7d ?? null, 'absolute'))}>
                        {fmtDelta(getPercentageChange(token.change7d ?? null, compareToken?.change7d ?? null, 'absolute'))}
                    </span>
                )}
            </td>
            {/* Layer 2 */}
            <td className="p-4 text-center">
                {hasSubnetSupport(token) ? (
                    <div className="inline-flex items-center justify-center w-6 h-6" title={`${token.symbol} supports Layer 2 transactions`}>
                        <Flame className="h-4 w-4 text-orange-400" />
                    </div>
                ) : (
                    <span className="text-white/20">-</span>
                )}
            </td>
        </tr>
    );
});

export default function TokenTable({ tokens, compareId }: TokenTableProps) {
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("market_cap");
    const [asc, setAsc] = useState<boolean>(false); // Default to descending for market cap
    const [showBalances, setShowBalances] = useState(false);
    const [isComparisonChanging, setIsComparisonChanging] = useState(false);
    const [previousCompareId, setPreviousCompareId] = useState<string | null>(compareId);

    // Detect comparison token changes and trigger skeleton loading
    useEffect(() => {
        if (compareId !== previousCompareId) {
            setIsComparisonChanging(true);
            setPreviousCompareId(compareId);
        }
    }, [compareId, previousCompareId]);

    // Reset loading state when comparison has stabilized
    useEffect(() => {
        if (isComparisonChanging) {
            // Reset loading state after comparison data has time to process
            const timer = setTimeout(() => {
                setIsComparisonChanging(false);
            }, 300);
            
            return () => clearTimeout(timer);
        }
    }, [isComparisonChanging, tokens, compareId]);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getBalance } = useBalances(address ? [address] : []);

    /* ------------- hot-key focus '/' ------------- */
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (
                e.key === "/" &&
                !(
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    (e.target as HTMLElement).isContentEditable
                )
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    const compareToken = useMemo(() => tokens.find((t) => t.contractId === compareId) ?? null, [tokens, compareId]);

    // Calculate difference with better fallback handling
    function diff(a: number | null, b: number | null) {
        if (a === null || b === null) return null;
        return a - b;
    }

    // Get percentage change with fallback to absolute values
    function getPercentageChange(tokenChange: number | null, compareTokenChange: number | null, mode: 'absolute' | 'relative' = 'relative'): number | null {
        if (tokenChange === null) return null;
        
        // If no comparison token or comparison mode is absolute, return the raw percentage
        if (compareTokenChange === null || mode === 'absolute') {
            return tokenChange;
        }
        
        // Return the difference (relative comparison)
        return tokenChange - compareTokenChange;
    }

    // Get market cap (pre-calculated or real-time adjusted)
    function getMarketCap(token: TokenSummary): number | null {
        // If we have real-time price updates, recalculate market cap
        const currentPrice = getPrice(token.contractId);
        if (currentPrice && currentPrice !== token.price && token.total_supply) {
            try {
                const supply = parseFloat(token.total_supply);
                const decimals = token.decimals || 6;
                const adjustedSupply = supply / Math.pow(10, decimals);
                return currentPrice * adjustedSupply;
            } catch {
                return token.marketCap; // Fallback to pre-calculated
            }
        }
        
        // Use pre-calculated market cap
        return token.marketCap;
    }

    // Get current price (real-time or fallback)
    function getCurrentPrice(token: TokenSummary): number | null {
        return getPrice(token.contractId) ?? token.price;
    }

    function getSortValue(token: TokenSummary, key: SortKey) {
        switch (key) {
            case "name":
                return token.name.toLowerCase();
            case "market_cap":
                return getMarketCap(token) ?? 0;
            case "price":
                return getCurrentPrice(token) ?? 0;
            case "change1h":
                return getPercentageChange(token.change1h ?? null, compareToken?.change1h ?? null, 'absolute') ?? -Infinity;
            case "change24h":
                return getPercentageChange(token.change24h ?? null, compareToken?.change24h ?? null, 'absolute') ?? -Infinity;
            case "change7d":
                return getPercentageChange(token.change7d ?? null, compareToken?.change7d ?? null, 'absolute') ?? -Infinity;
            default:
                return 0;
        }
    }

    // Check if a token has subnet support (simplified for new contexts)
    function hasSubnetSupport(token: TokenSummary): boolean {
        return false; // Subnet functionality not yet implemented with new contexts
    }

    const filtered = useMemo(() => {
        const startTime = performance.now();
        const q = query.trim().toLowerCase();
        let out = tokens;
        
        // Apply search filter if query exists
        if (q) {
            out = tokens.filter((t) =>
                t.name.toLowerCase().includes(q) ||
                t.symbol.toLowerCase().includes(q) ||
                t.contractId.toLowerCase().includes(q)
            );
        }

        // Sort results
        out = [...out].sort((a, b) => {
            const dir = asc ? 1 : -1;
            const aVal = getSortValue(a, sortKey);
            const bVal = getSortValue(b, sortKey);
            if (aVal === bVal) return 0;
            return aVal > bVal ? dir : -dir;
        });

        const duration = performance.now() - startTime;
        if (duration > 10) { // Log if filtering takes more than 10ms
            console.log('[TOKEN-TABLE] Filtering took', duration.toFixed(2), 'ms for', tokens.length, 'tokens');
        }

        return out;
    }, [tokens, query, sortKey, asc, compareToken]);

    function toggleSort(key: SortKey) {
        if (key === sortKey) {
            setAsc(!asc);
        } else {
            setSortKey(key);
            // Default to descending for market cap and price, ascending for others
            setAsc(key === "market_cap" || key === "price" ? false : true);
        }
    }

    return (
        <div className="w-full">
            {/* Clean search and controls - no heavy borders */}
            <div className="mb-8 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search tokens..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-12 pl-12 pr-12 rounded-xl border border-white/[0.1] bg-white/[0.02] text-white/90 placeholder:text-white/40 focus:outline-none focus:border-white/[0.3] transition-colors duration-200"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-white/30 border border-white/[0.1] rounded px-2 py-1 bg-white/[0.03] select-none">
                        /
                    </span>
                </div>
                
                {address && (
                    <button
                        onClick={() => setShowBalances(!showBalances)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 ${
                            showBalances 
                                ? 'bg-white/[0.08] text-white border-white/[0.2]' 
                                : 'text-white/60 border-white/[0.1] hover:text-white/90 hover:bg-white/[0.03]'
                        }`}
                    >
                        <Wallet className="h-4 w-4" />
                        <span className="text-sm">Portfolio</span>
                    </button>
                )}
            </div>

            {/* Clean table with minimal styling */}
            <div className="overflow-x-auto rounded-2xl border border-white/[0.05]">
                <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-20">
                        <tr className="border-b border-white/[0.05]">
                            {headerCell("Token", "name", "sticky left-0 z-10 w-[14rem]")}
                            {headerCell("Market Cap", "market_cap", "text-right")}
                            {headerCell("Price", "price", "text-right")}
                            {showBalances && address && (
                                <th className="p-4 text-center backdrop-blur-sm">
                                    <div className="inline-flex items-center gap-2 text-white/60">
                                        <Wallet className="h-3.5 w-3.5" />
                                        <span>Balance</span>
                                    </div>
                                </th>
                            )}
                            {headerCell("1h", "change1h", "text-right")}
                            {headerCell("24h", "change24h", "text-right")}
                            {headerCell("7d", "change7d", "text-right")}
                            <th className="p-4 text-center backdrop-blur-sm">
                                <div className="inline-flex items-center gap-2 text-white/60">
                                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                                    <span>Layer 2</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((token) => (
                            <EnhancedTokenRow 
                                key={token.contractId} 
                                token={token} 
                                showBalances={showBalances} 
                                address={address} 
                                compareToken={compareToken}
                                getMarketCap={getMarketCap}
                                getPercentageChange={getPercentageChange}
                                hasSubnetSupport={hasSubnetSupport}
                                isComparisonChanging={isComparisonChanging}
                            />
                        ))}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={showBalances && address ? 8 : 7} className="p-8 text-center text-white/40">
                                    No tokens found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    function headerCell(label: string, key: SortKey, extraClass = "") {
        const active = sortKey === key;
        return (
            <th
                onClick={() => toggleSort(key)}
                className={`p-4 cursor-pointer select-none backdrop-blur-sm ${extraClass}`}
            >
                <div className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 transition-colors duration-200">
                    <span className="text-sm font-medium">{label}</span>
                    <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-white/90" : "text-white/30"}`} />
                </div>
            </th>
        );
    }
}

/* ---------------- helpers ---------------- */
function fmtPrice(price: number | null) {
    if (price === null) return "-";

    // Dynamic price formatting based on price range
    if (price >= 1000) {
        // Large prices: show 2 decimal places
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
        // Medium prices: show 2-4 decimal places
        return `$${price.toFixed(4).replace(/\.?0+$/, '')}`;
    } else if (price >= 0.01) {
        // Small prices: show 3-4 decimal places
        return `$${price.toFixed(4)}`;
    } else if (price >= 0.0001) {
        // Very small prices: show 6 decimal places
        return `$${price.toFixed(6)}`;
    } else if (price >= 0.000001) {
        // Extremely small prices: show 8 decimal places
        return `$${price.toFixed(8)}`;
    } else if (price > 0) {
        // Microscopic prices: use scientific notation
        return `$${price.toExponential(3)}`;
    } else {
        return "$0.00";
    }
}

function fmtMarketCap(marketCap: number | null) {
    if (marketCap === null) return "-";

    if (marketCap >= 1e9) {
        return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
        return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else if (marketCap >= 1e3) {
        return `$${(marketCap / 1e3).toFixed(2)}K`;
    } else {
        return `$${marketCap.toFixed(2)}`;
    }
}

function fmtDelta(delta: number | null) {
    if (delta === null) return "-";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(2)}%`;
}

function getDeltaColour(delta: number | null) {
    if (delta === null) return "text-muted-foreground";
    if (delta > 0) return "text-green-600";
    if (delta < 0) return "text-red-600";
    return "";
}

function getCleanDeltaColour(delta: number | null) {
    if (delta === null) return "text-white/40";
    if (delta > 0) return "text-emerald-400";
    if (delta < 0) return "text-red-400";
    return "text-white/60";
} 