"use client";

import React from "react";
import { Download, Heart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenFiltersProps {
    categoryFilter: string;
    setCategoryFilter: (category: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
    hasArbitrageCategory?: boolean;
    className?: string;
}

export default function TokenFilters({
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
    hasArbitrageCategory = false,
    className
}: TokenFiltersProps) {

    const categories = [
        { id: "all", label: "All Tokens", icon: "🔍" },
        { id: "stablecoin", label: "Stablecoins", icon: "💰" },
        { id: "defi", label: "DeFi", icon: "🏦" },
        { id: "governance", label: "Governance", icon: "🗳️" },
        // Conditionally add arbitrage category
        ...(hasArbitrageCategory ? [{ id: "arbitrage", label: "Arbitrage", icon: "⚡" }] : [])
    ];

    const sortOptions = [
        { id: "market_cap", label: "Market Cap" },
        { id: "price", label: "Price" },
        { id: "change24h", label: "24h Change" },
        { id: "change7d", label: "7d Change" },
        { id: "name", label: "Name" },
        { id: "source", label: "Source" },
        { id: "arbitrage", label: "Arbitrage %" },
    ];

    const handleExport = () => {
        // Simple CSV export functionality
        if (typeof window !== "undefined") {
            const csvContent = "data:text/csv;charset=utf-8,"
                + "Name,Symbol,Price,24h Change,7d Change\n"
                + "Example,EXM,$1.00,+5.2%,+12.1%\n"; // Placeholder

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "tokens.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className={cn("", className)}>
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
                {/* Clean category filters - no heavy borders */}
                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setCategoryFilter(category.id)}
                            className={cn(
 "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                                categoryFilter === category.id
                                    ? category.id === "arbitrage"
                                        ? "bg-warning/10 text-warning border border-warning/30"
                                        : "bg-surface-hover text-ink border border-line-strong"
                                    : "text-ink-muted hover:text-ink hover:bg-surface border border-transparent"
                            )}
                        >
                            <span className="text-xs">{category.icon}</span>
                            {category.label}
                            {category.id === "arbitrage" && hasArbitrageCategory && (
                                <TrendingUp className="h-3 w-3" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Minimal sort & actions */}
                <div className="flex items-center gap-4">
                    {/* Clean sort selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-ink-muted">Sort by</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-transparent border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong transition-colors duration-200"
                        >
                            {sortOptions.map((option) => (
                                <option key={option.id} value={option.id} className="bg-surface-raised text-ink">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subtle action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="p-2 rounded-xl hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-all duration-200"
                            title="Export data"
                        >
                            <Download className="h-4 w-4" />
                        </button>

                        <button
                            className="p-2 rounded-xl hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-all duration-200"
                            title="Watchlist"
                        >
                            <Heart className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}