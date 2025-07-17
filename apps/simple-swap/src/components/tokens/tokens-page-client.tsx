"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { TokenSummary } from "@/app/token-actions";
import CompareTokenSelector from "./compare-token-selector";
import TokenTable from "./token-table";
import MarketHighlights from "./market-highlights";
import TokenFilters from "./token-filters";
import MarketInsights from "./market-insights";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useComparisonToken } from "@/contexts/comparison-token-context";

interface Props {
    tokens: TokenSummary[];
}

export default function TokensPageClient({ tokens }: Props) {
    // Use shared comparison context instead of local state
    const { compareId, setCompareId, isInitialized } = useComparisonToken();
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("market_cap");

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Create token stats
    const tokenStats = useMemo(() => {
        const typeCount = new Map<string, number>();
        const subnetTokens: TokenSummary[] = [];

        tokens.forEach(token => {
            const type = token.type || 'UNKNOWN';
            typeCount.set(type, (typeCount.get(type) || 0) + 1);

            // Count SUBNET tokens for statistics
            if (token.type === "SUBNET") {
                subnetTokens.push(token);
            }
        });

        return {
            typeCount,
            subnetTokenCount: subnetTokens.length,
            tokensWithoutImages: tokens.filter(t => !t.image).length
        };
    }, [tokens]);

    // Apply default filters - remove tokens without images AND subnet tokens
    const defaultFilteredTokens = useMemo(() => {
        return tokens.filter(token => {
            // Must have an image
            if (!token.image) return false;

            // Filter out SUBNET tokens from main list
            if (token.type === "SUBNET") return false;

            // Must have a valid contractId
            if (!token.contractId || typeof token.contractId !== 'string' || token.contractId.trim() === '') {
                console.warn('Token missing or invalid contractId:', token);
                return false;
            }

            return true;
        });
    }, [tokens]);

    // compareId initialization is now handled by ComparisonTokenContext

    // init filters from URL
    useEffect(() => {
        const urlCategory = searchParams?.get("category");
        const urlSort = searchParams?.get("sort");
        if (urlCategory) setCategoryFilter(urlCategory);
        if (urlSort) setSortBy(urlSort);
    }, [searchParams]);

    // Set default comparison token when available (only after context is initialized)
    useEffect(() => {
        if (!isInitialized) return;

        if (!compareId && defaultFilteredTokens.length) {
            const stable = defaultFilteredTokens.find((t) => ["aUSD", "USDC", "USDT", "USD"].includes(t.symbol));
            setCompareId(stable ? stable.contractId : defaultFilteredTokens[0].contractId);
        }
    }, [compareId, defaultFilteredTokens, isInitialized, setCompareId]);

    // compareId persistence is now handled by ComparisonTokenContext

    // persist filters
    useEffect(() => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        if (categoryFilter !== "all") {
            params.set("category", categoryFilter);
        } else {
            params.delete("category");
        }
        if (sortBy !== "market_cap") {
            params.set("sort", sortBy);
        } else {
            params.delete("sort");
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [categoryFilter, sortBy, pathname, router, searchParams]);

    const compareToken = useMemo(() => defaultFilteredTokens.find((t) => t.contractId === compareId) ?? null, [defaultFilteredTokens, compareId]);

    // Filter tokens by category (after default filtering)
    const filteredTokens = useMemo(() => {
        if (categoryFilter === "all") return defaultFilteredTokens;

        // Simple category logic based on token symbols/names
        switch (categoryFilter) {
            case "stablecoin":
                return defaultFilteredTokens.filter(t =>
                    ["USDC", "USDT", "aUSD", "USD", "DAI", "FRAX"].includes(t.symbol) ||
                    t.name.toLowerCase().includes("usd") ||
                    t.name.toLowerCase().includes("stable")
                );
            case "defi":
                return defaultFilteredTokens.filter(t =>
                    ["UNI", "SUSHI", "AAVE", "COMP", "CRV", "YFI", "1INCH"].includes(t.symbol) ||
                    t.name.toLowerCase().includes("defi") ||
                    t.name.toLowerCase().includes("swap")
                );
            case "governance":
                return defaultFilteredTokens.filter(t =>
                    t.name.toLowerCase().includes("governance") ||
                    t.name.toLowerCase().includes("dao") ||
                    t.symbol.includes("GOV")
                );
            default:
                return defaultFilteredTokens;
        }
    }, [defaultFilteredTokens, categoryFilter]);

    return (
        <div className="space-y-16">
            {/* Immersive header - seamless design */}
            <div className="space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                    {/* Clean title section */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-medium text-white/95 tracking-wide mb-3">Token Explorer</h1>
                            <p className="text-white/60 max-w-2xl text-base leading-relaxed">
                                Discover live cryptocurrency prices with advanced market intelligence and pattern analysis.
                                Compare tokens and access actionable insights for informed decisions.
                            </p>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-white/40">
                            <span>{filteredTokens.length} tokens</span>
                            {compareToken && (
                                <span>Baseline: {compareToken.symbol}</span>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                    <div className="absolute inset-0 h-1.5 w-1.5 bg-emerald-400/40 rounded-full animate-ping" />
                                    <div className="absolute inset-[-1px] h-2.5 w-2.5 bg-emerald-400/20 rounded-full blur-sm animate-pulse" />
                                </div>
                                <span className="animate-pulse">Live data</span>
                            </div>
                        </div>
                    </div>

                    {compareToken && (
                        <CompareTokenSelector
                            tokens={defaultFilteredTokens}
                            primary={compareToken}
                            selectedId={compareId}
                            onSelect={setCompareId}
                        />
                    )}
                </div>
            </div>

            {/* Market Highlights - flowing design */}
            <MarketHighlights tokens={defaultFilteredTokens} />

            {/* Market Intelligence - seamless integration */}
            <MarketInsights tokens={defaultFilteredTokens} />

            {/* Clean filters */}
            <div className="pt-8 border-t border-white/[0.05]">
                <TokenFilters
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                />
            </div>

            {/* Token table */}
            <TokenTable tokens={filteredTokens} compareId={compareId} />
        </div>
    );
} 