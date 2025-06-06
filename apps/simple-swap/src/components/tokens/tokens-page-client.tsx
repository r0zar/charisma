"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { TokenSummary } from "@/app/token-actions";
import CompareTokenSelector from "./compare-token-selector";
import TokenTable from "./token-table";
import MarketHighlights from "./market-highlights";
import TokenFilters from "./token-filters";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
    tokens: TokenSummary[];
}

export default function TokensPageClient({ tokens }: Props) {
    const [compareId, setCompareId] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("market_cap");

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Create subnet mapping and token stats
    const { tokenStats, subnetMapping } = useMemo(() => {
        const typeCount = new Map<string, number>();
        const subnetTokens: TokenSummary[] = [];
        const subnetMap = new Map<string, TokenSummary>();

        tokens.forEach(token => {
            const type = token.type || 'UNKNOWN';
            typeCount.set(type, (typeCount.get(type) || 0) + 1);

            // Collect SUBNET tokens and create mapping by symbol
            if (token.type === "SUBNET") {
                subnetTokens.push(token);
                subnetMap.set(token.symbol, token);
            }
        });

        console.log("Token types:", Object.fromEntries(typeCount));
        console.log("SUBNET tokens found:", subnetTokens.map(t => t.symbol));
        console.log("Subnet mapping created for symbols:", Array.from(subnetMap.keys()));

        return {
            tokenStats: {
                typeCount,
                subnetTokenCount: subnetTokens.length,
                tokensWithoutImages: tokens.filter(t => !t.image).length
            },
            subnetMapping: subnetMap
        };
    }, [tokens]);

    // Apply default filters - remove tokens without images AND subnet tokens
    const defaultFilteredTokens = useMemo(() => {
        return tokens.filter(token => {
            // Must have an image
            if (!token.image) return false;

            // Filter out SUBNET tokens from main list
            if (token.type === "SUBNET") return false;

            return true;
        });
    }, [tokens]);

    // init compareId
    useEffect(() => {
        if (compareId) return;
        const urlC = searchParams?.get("compare");
        if (urlC) {
            setCompareId(urlC);
            return;
        }
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("compareTokenId");
            if (stored) {
                setCompareId(stored);
            }
        }
    }, [compareId, searchParams]);

    // init filters from URL
    useEffect(() => {
        const urlCategory = searchParams?.get("category");
        const urlSort = searchParams?.get("sort");
        if (urlCategory) setCategoryFilter(urlCategory);
        if (urlSort) setSortBy(urlSort);
    }, [searchParams]);

    // default fallback
    useEffect(() => {
        if (!compareId && defaultFilteredTokens.length) {
            const stable = defaultFilteredTokens.find((t) => ["aUSD", "USDC", "USDT", "USD"].includes(t.symbol));
            setCompareId(stable ? stable.contractId : defaultFilteredTokens[0].contractId);
        }
    }, [compareId, defaultFilteredTokens]);

    // persist compareId
    useEffect(() => {
        if (!compareId) return;
        if (typeof window !== "undefined") {
            localStorage.setItem("compareTokenId", compareId);
        }
        const params = new URLSearchParams(searchParams?.toString());
        params.set("compare", compareId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [compareId, pathname, router, searchParams]);

    // persist filters
    useEffect(() => {
        const params = new URLSearchParams(searchParams?.toString());
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
        <>
            {/* Header row with title and selector */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                {/* title & subtitle */}
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Token Explorer</h1>
                    <p className="text-muted-foreground max-w-2xl text-lg">
                        Discover and track live cryptocurrency prices, market data, and analytics.
                        Compare tokens and access detailed information for informed trading decisions.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Showing {filteredTokens.length} of {tokens.length} tokens
                        • Filtered: No images ({tokenStats.tokensWithoutImages}), SUBNET tokens ({tokenStats.subnetTokenCount})
                        • Subnet versions available: {subnetMapping.size}
                    </p>
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

            {/* Market Highlights */}
            <MarketHighlights tokens={defaultFilteredTokens} className="mb-8" />

            {/* Filters */}
            <TokenFilters
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                className="mb-6"
            />

            {/* token table */}
            <TokenTable tokens={filteredTokens} compareId={compareId} subnetMapping={subnetMapping} />
        </>
    );
} 