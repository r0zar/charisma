"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { ArrowUpDown, Search, Flame, Wallet, TrendingUp, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { TokenSummary } from "@/types/token-types";
import { usePrices } from '@/contexts/token-price-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { formatCompactNumber } from '@/lib/swap-utils';
import { getIpfsUrl } from '@/lib/utils';

// Enhanced token interface
interface EnhancedTokenSummary extends TokenSummary {
    reliability?: number;
    source?: 'oracle' | 'market' | 'virtual' | 'hybrid';
    arbitrageOpportunity?: {
        marketPrice: number;
        virtualValue: number;
        deviation: number;
        profitable: boolean;
    };
}

interface TokenTableProps {
    tokens: (TokenSummary | EnhancedTokenSummary)[];
    compareId: string | null;
    priceHistories?: Record<string, any[]>;
    hasEnhancedData?: boolean;
}

type SortKey = "name" | "market_cap" | "price" | "change1h" | "change24h" | "change7d" | "source" | "arbitrage";

// Mini sparkline component
function Sparkline({ data, width = 60, height = 20, color = "#10b981" }: {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
}) {
    // Show sparklines even with limited data - single point shows as flat line
    if (!data || data.length === 0) return null;
    
    // For single data point, duplicate it to create a flat line
    const chartData = data.length === 1 ? [data[0], data[0]] : data;

    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    const range = max - min || 1;

    const points = chartData.map((value, index) => {
        const x = (index / (chartData.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const isPositive = chartData[chartData.length - 1] > chartData[0];
    const lineColor = isPositive ? "#10b981" : "#ef4444";

    return (
        <svg width={width} height={height} className="inline-block">
            <polyline
                fill="none"
                stroke={lineColor}
                strokeWidth="1.5"
                points={points}
            />
        </svg>
    );
}

// Source badge component
function SourceBadge({ source }: { source?: string }) {
    if (!source) return null;

    const config = {
        oracle: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Oracle' },
        market: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Market' },
        virtual: { color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Virtual' },
        hybrid: { color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Hybrid' }
    }[source] || { color: 'text-white/40', bg: 'bg-white/5', label: source };

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.color}`}>
            {config.label}
        </span>
    );
}

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

// Balance cell component
const BalanceCell = React.memo(function BalanceCell({
    token,
    address
}: {
    token: TokenSummary;
    address: string;
}) {
    const { getTokenBalance, isLoading, error } = useBalances(address ? [address] : []);
    const { getPrice } = usePrices();

    // Get raw balance
    const rawBalance = getTokenBalance(address, token.contractId);

    // Calculate USD value if price is available
    const currentPrice = getPrice(token.contractId) ?? token.price;
    const usdValue = currentPrice && rawBalance > 0 
        ? (rawBalance / Math.pow(10, token.decimals || 6)) * currentPrice 
        : null;

    // Loading state
    if (isLoading) {
        return (
            <div className="text-right">
                <div className="animate-pulse bg-white/5 h-4 w-16 rounded"></div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="text-right">
                <span className="text-white/20">-</span>
            </div>
        );
    }

    // No balance
    if (rawBalance === 0) {
        return (
            <div className="text-right">
                <span className="text-white/40">0</span>
            </div>
        );
    }

    return (
        <div className="text-right">
            <div className="font-mono text-white/90">
                {formatCompactNumber(rawBalance / Math.pow(10, token.decimals || 6))}
            </div>
            {usdValue && usdValue > 0.01 && (
                <div className="text-xs text-white/50 font-mono mt-0.5">
                    ${formatCompactNumber(usdValue)}
                </div>
            )}
        </div>
    );
});

// Enhanced price cell with source indicator
const EnhancedTokenPriceCell = React.memo(function EnhancedTokenPriceCell({
    token
}: {
    token: TokenSummary | EnhancedTokenSummary
}) {
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
            const timer = setTimeout(() => setIsUpdating(false), 1000);
            return () => clearTimeout(timer);
        }
        setLastPrice(currentPrice);
    }, [currentPrice, lastPrice]);

    const getPriceChangeColor = () => {
        if (!isUpdating) return 'text-white/90';

        if (currentPrice !== null && lastPrice !== null) {
            return currentPrice > lastPrice ? 'text-emerald-300' : currentPrice < lastPrice ? 'text-red-300' : 'text-white/90';
        }
        return 'text-white/90';
    };

    return (
        <div className="text-right">
            <div className={`font-mono transition-all duration-1000 ${getPriceChangeColor()} ${isUpdating ? 'transform scale-105 drop-shadow-sm' : ''
                }`}>
                {fmtPrice(currentPrice)}
            </div>
            <div className="flex items-center justify-end gap-1 mt-1">
                {hasRealTimePrice && (
                    <span className={`text-[10px] font-medium transition-all duration-1000 ${isUpdating ? 'text-emerald-300' : 'text-emerald-400/60'
                        }`}>
                        LIVE
                    </span>
                )}
                {'source' in token && token.source && (
                    <SourceBadge source={token.source} />
                )}
            </div>
        </div>
    );
});

export default function TokenTable({
    tokens,
    compareId,
    priceHistories = {},
    hasEnhancedData = false
}: TokenTableProps) {
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("market_cap");
    const [asc, setAsc] = useState<boolean>(false);
    const [showBalances, setShowBalances] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const { address } = useWallet();
    const { getPrice } = usePrices();

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

    // Get percentage change with fallback to absolute values
    function getPercentageChange(tokenChange: number | null, compareTokenChange: number | null, mode: 'absolute' | 'relative' = 'relative'): number | null {
        if (tokenChange === null) return null;

        if (compareTokenChange === null || mode === 'absolute') {
            return tokenChange;
        }

        return tokenChange - compareTokenChange;
    }

    // Get market cap
    function getMarketCap(token: TokenSummary): number | null {
        const currentPrice = getPrice(token.contractId);
        if (currentPrice && currentPrice !== token.price && token.total_supply) {
            try {
                const supply = parseFloat(token.total_supply);
                const decimals = token.decimals || 6;
                const adjustedSupply = supply / Math.pow(10, decimals);
                return currentPrice * adjustedSupply;
            } catch {
                return token.marketCap;
            }
        }

        return token.marketCap;
    }

    // Get current price
    function getCurrentPrice(token: TokenSummary): number | null {
        return getPrice(token.contractId) ?? token.price;
    }

    // Enhanced sort function
    function getSortValue(token: TokenSummary | EnhancedTokenSummary, key: SortKey) {
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
            case "source":
                return ('source' in token && token.source) || 'unknown';
            case "arbitrage":
                return ('arbitrageOpportunity' in token && token.arbitrageOpportunity?.deviation) || 0;
            default:
                return 0;
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let out = tokens;

        if (q) {
            out = tokens.filter((t) =>
                t.name.toLowerCase().includes(q) ||
                t.symbol.toLowerCase().includes(q) ||
                t.contractId.toLowerCase().includes(q)
            );
        }

        out = [...out].sort((a, b) => {
            const dir = asc ? 1 : -1;
            const aVal = getSortValue(a, sortKey);
            const bVal = getSortValue(b, sortKey);
            if (aVal === bVal) return 0;
            return aVal > bVal ? dir : -dir;
        });

        return out;
    }, [tokens, query, sortKey, asc, compareToken]);

    function toggleSort(key: SortKey) {
        if (key === sortKey) {
            setAsc(!asc);
        } else {
            setSortKey(key);
            setAsc(key === "market_cap" || key === "price" || key === "arbitrage" ? false : true);
        }
    }

    return (
        <div className="w-full">
            {/* Clean search and controls */}
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

                {address ? (
                    <button
                        onClick={() => setShowBalances(!showBalances)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 ${showBalances
                                ? 'bg-white/[0.08] text-white border-white/[0.2]'
                                : 'text-white/60 border-white/[0.1] hover:text-white/90 hover:bg-white/[0.03]'
                            }`}
                    >
                        <Wallet className="h-4 w-4" />
                        <span className="text-sm">Portfolio</span>
                    </button>
                ) : (
                    <button
                        onClick={() => {}}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] text-white/40 cursor-not-allowed"
                        disabled
                        title="Connect wallet to view balances"
                    >
                        <Wallet className="h-4 w-4" />
                        <span className="text-sm">Connect Wallet</span>
                    </button>
                )}
            </div>

            {/* Enhanced table */}
            <div className="overflow-x-auto rounded-2xl border border-white/[0.05]">
                <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-20">
                        <tr className="border-b border-white/[0.05]">
                            {headerCell("Token", "name", "sticky left-0 z-10 w-[14rem]")}
                            {headerCell("Market Cap", "market_cap", "text-right")}
                            {headerCell("Price", "price", "text-right min-w-[120px]")}
                            {showBalances && address && (
                                <th className="p-4 text-center backdrop-blur-sm">
                                    <div className="inline-flex items-center gap-2 text-white/60">
                                        <Wallet className="h-3.5 w-3.5" />
                                        <span>Balance</span>
                                    </div>
                                </th>
                            )}
                            <th className="p-4 text-center backdrop-blur-sm min-w-[80px]">
                                <div className="inline-flex items-center gap-1 text-white/60">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    <span>24h</span>
                                </div>
                            </th>
                            {headerCell("1h", "change1h", "text-right")}
                            {headerCell("24h", "change24h", "text-right")}
                            {headerCell("7d", "change7d", "text-right")}
                            {hasEnhancedData && headerCell("Source", "source", "text-center")}
                            {hasEnhancedData && headerCell("Arb %", "arbitrage", "text-right")}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((token) => (
                            <TokenRow
                                key={token.contractId}
                                token={token}
                                showBalances={showBalances}
                                address={address}
                                compareToken={compareToken}
                                priceHistory={priceHistories[token.contractId]}
                                hasEnhancedData={hasEnhancedData}
                            />
                        ))}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={showBalances && address ? 10 : 9} className="p-8 text-center text-white/40">
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

// Enhanced token row component
interface TokenRowProps {
    token: TokenSummary | EnhancedTokenSummary;
    showBalances: boolean;
    address: string | null;
    compareToken: TokenSummary | null;
    priceHistory?: any[];
    hasEnhancedData: boolean;
}

const TokenRow = React.memo(function TokenRow({
    token,
    showBalances,
    address,
    compareToken,
    priceHistory,
    hasEnhancedData
}: TokenRowProps) {
    const sparklineData = useMemo(() => {
        if (!priceHistory || priceHistory.length < 2) return null;
        return priceHistory.map(entry => entry.usdPrice || entry.price);
    }, [priceHistory]);

    const isArbitrageOpp = 'arbitrageOpportunity' in token && token.arbitrageOpportunity?.profitable;

    return (
        <tr
            className={`cursor-pointer transition-all duration-200 border-b border-white/[0.03] hover:bg-white/[0.02] ${isArbitrageOpp ? 'bg-amber-500/5' : ''
                }`}
        >
            {/* Token */}
            <td className="p-4 sticky left-0 backdrop-blur-sm z-10 w-[14rem]">
                <Link href={`/tokens/${encodeURIComponent(token.contractId)}`} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center overflow-hidden">
                        <TokenImage token={token} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight truncate max-w-[10rem] text-white/90">{token.name}</div>
                        <div className="text-xs text-white/50 font-mono">{token.symbol}</div>
                    </div>
                </Link>
            </td>

            {/* Market Cap */}
            <td className="p-4 text-right font-mono text-white/80">{fmtMarketCap(token.marketCap)}</td>

            {/* Price */}
            <td className="p-4">
                <EnhancedTokenPriceCell token={token} />
            </td>

            {/* Balance (conditional) */}
            {showBalances && address && (
                <td className="p-4">
                    <BalanceCell token={token} address={address} />
                </td>
            )}

            {/* 24h Sparkline */}
            <td className="p-4 text-center">
                {sparklineData && sparklineData.length > 0 ? (
                    <Sparkline data={sparklineData} />
                ) : (
                    <span className="text-white/20">-</span>
                )}
            </td>

            {/* Change columns */}
            <td className="p-4 text-right font-mono">
                <span className={getCleanDeltaColour(token.change1h)}>
                    {fmtDelta(token.change1h)}
                </span>
            </td>
            <td className="p-4 text-right font-mono">
                <span className={getCleanDeltaColour(token.change24h)}>
                    {fmtDelta(token.change24h)}
                </span>
            </td>
            <td className="p-4 text-right font-mono">
                <span className={getCleanDeltaColour(token.change7d)}>
                    {fmtDelta(token.change7d)}
                </span>
            </td>

            {/* Enhanced columns */}
            {hasEnhancedData && (
                <td className="p-4 text-center">
                    {'source' in token && token.source ? (
                        <SourceBadge source={token.source} />
                    ) : (
                        <span className="text-white/20">-</span>
                    )}
                </td>
            )}
            {hasEnhancedData && (
                <td className="p-4 text-right font-mono">
                    {'arbitrageOpportunity' in token && token.arbitrageOpportunity ? (
                        <span className={`${token.arbitrageOpportunity.profitable ? 'text-amber-400' : 'text-white/40'
                            }`}>
                            {token.arbitrageOpportunity.deviation.toFixed(1)}%
                        </span>
                    ) : (
                        <span className="text-white/20">-</span>
                    )}
                </td>
            )}
        </tr>
    );
});

/* ---------------- helpers ---------------- */
function fmtPrice(price: number | null) {
    if (price === null) return "-";

    if (price >= 1000) {
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
        return `$${price.toFixed(4).replace(/\.?0+$/, '')}`;
    } else if (price >= 0.01) {
        return `$${price.toFixed(4)}`;
    } else if (price >= 0.0001) {
        return `$${price.toFixed(6)}`;
    } else if (price >= 0.000001) {
        return `$${price.toFixed(8)}`;
    } else if (price > 0) {
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

function getCleanDeltaColour(delta: number | null) {
    if (delta === null) return "text-white/40";
    if (delta > 0) return "text-emerald-400";
    if (delta < 0) return "text-red-400";
    return "text-white/60";
}