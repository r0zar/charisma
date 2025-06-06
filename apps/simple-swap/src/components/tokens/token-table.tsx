"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { ArrowUpDown, Search, Flame } from "lucide-react";
import Image from "next/image";
import type { TokenSummary } from "@/app/token-actions";

interface TokenTableProps {
    tokens: TokenSummary[];
    compareId: string | null;
    subnetMapping: Map<string, TokenSummary>;
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
            src={token.image}
            alt={token.symbol}
            width={32}
            height={32}
            className="object-cover"
            onError={() => setImageError(true)}
        />
    );
}

export default function TokenTable({ tokens, compareId, subnetMapping }: TokenTableProps) {
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("market_cap");
    const [asc, setAsc] = useState<boolean>(false); // Default to descending for market cap

    const searchInputRef = useRef<HTMLInputElement>(null);

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

    function diff(a: number | null, b: number | null) {
        if (a === null || b === null) return null;
        return a - b;
    }

    // Calculate market cap from price and total supply
    function getMarketCap(token: TokenSummary): number | null {
        if (!token.price || !token.total_supply) return null;
        try {
            const supply = parseFloat(token.total_supply);
            const decimals = token.decimals || 6;
            const adjustedSupply = supply / Math.pow(10, decimals);
            return token.price * adjustedSupply;
        } catch {
            return null;
        }
    }

    function getSortValue(token: TokenSummary, key: SortKey) {
        switch (key) {
            case "name":
                return token.name.toLowerCase();
            case "market_cap":
                return getMarketCap(token) ?? 0;
            case "price":
                return token.price ?? 0;
            case "change1h":
                return diff(token.change1h, compareToken?.change1h ?? null) ?? -Infinity;
            case "change24h":
                return diff(token.change24h, compareToken?.change24h ?? null) ?? -Infinity;
            case "change7d":
                return diff(token.change7d, compareToken?.change7d ?? null) ?? -Infinity;
            default:
                return 0;
        }
    }

    // Check if a token has a subnet version available
    function hasSubnetVersion(token: TokenSummary): boolean {
        return subnetMapping.has(token.symbol);
    }

    // Get the subnet version of a token
    function getSubnetVersion(token: TokenSummary): TokenSummary | undefined {
        return subnetMapping.get(token.symbol);
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
            // Default to descending for market cap and price, ascending for others
            setAsc(key === "market_cap" || key === "price" ? false : true);
        }
    }

    return (
        <div className="w-full">
            {/* Search */}
            <div className="mb-6">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search by name, symbol or address"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-12 pl-10 pr-12 rounded-lg border border-input bg-background text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5 bg-muted/50 select-none">
                        /
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted text-muted-foreground sticky top-0 z-20">
                        <tr>
                            {headerCell("Token", "name", "sticky bg-muted left-0 z-10 w-[14rem]")}
                            {headerCell("Market Cap", "market_cap", "text-right")}
                            {headerCell("Price", "price", "text-right")}
                            {headerCell("1h %", "change1h", "text-right")}
                            {headerCell("24h %", "change24h", "text-right")}
                            {headerCell("7d %", "change7d", "text-right")}
                            <th className="p-4 text-center">
                                <div className="inline-flex items-center gap-1">
                                    <Flame className="h-3.5 w-3.5 text-red-500" />
                                    <span>Subnets</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filtered.map((token) => (
                            <tr
                                key={token.contractId}
                                className="hover:bg-muted/20 cursor-pointer"
                                onClick={() => (window.location.href = `/tokens/${encodeURIComponent(token.contractId)}`)}
                            >
                                {/* Token */}
                                <td className="p-4 flex items-center gap-3 sticky left-0 bg-card z-10 w-[14rem]">
                                    <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden">
                                        <TokenImage token={token} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium leading-tight truncate max-w-[10rem]">{token.name}</div>
                                        <div className="text-xs text-muted-foreground">{token.symbol}</div>
                                    </div>
                                </td>
                                {/* Market Cap */}
                                <td className="p-4 text-right font-medium">{fmtMarketCap(getMarketCap(token))}</td>
                                {/* Price */}
                                <td className="p-4 text-right font-medium">{fmtPrice(token.price)}</td>
                                {/* 1h */}
                                <td className={`p-4 text-right ${getDeltaColour(diff(token.change1h, compareToken?.change1h ?? null))}`}>{fmtDelta(diff(token.change1h, compareToken?.change1h ?? null))}</td>
                                {/* 24h */}
                                <td className={`p-4 text-right ${getDeltaColour(diff(token.change24h, compareToken?.change24h ?? null))}`}>{fmtDelta(diff(token.change24h, compareToken?.change24h ?? null))}</td>
                                {/* 7d */}
                                <td className={`p-4 text-right ${getDeltaColour(diff(token.change7d, compareToken?.change7d ?? null))}`}>{fmtDelta(diff(token.change7d, compareToken?.change7d ?? null))}</td>
                                {/* Subnets */}
                                <td className="p-4 text-center">
                                    {hasSubnetVersion(token) ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const subnetToken = getSubnetVersion(token);
                                                if (subnetToken) {
                                                    window.location.href = `/tokens/${encodeURIComponent(subnetToken.contractId)}`;
                                                }
                                            }}
                                            className="cursor-pointer inline-flex items-center justify-center w-6 h-6 rounded hover:bg-muted/90 transition-colors"
                                            title={`View subnet version of ${token.symbol}`}
                                        >
                                            <Flame className="h-4 w-4 text-red-500" />
                                        </button>
                                    ) : (
                                        <span className="text-muted-foreground/30">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                                    No tokens match your query.
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
                className={`p-4 cursor-pointer select-none ${extraClass}`}
            >
                <div className="inline-flex items-center gap-1">
                    {label}
                    <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />
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