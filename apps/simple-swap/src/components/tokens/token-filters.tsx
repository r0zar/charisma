"use client";

import React from "react";
import { Filter, SortAsc, SortDesc, Download, Heart, Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenFiltersProps {
    categoryFilter: string;
    setCategoryFilter: (category: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
    className?: string;
}

const categories = [
    { id: "all", label: "All Tokens", icon: "🔍" },
    { id: "stablecoin", label: "Stablecoins", icon: "💰" },
    { id: "defi", label: "DeFi", icon: "🏦" },
    { id: "governance", label: "Governance", icon: "🗳️" },
];

const sortOptions = [
    { id: "market_cap", label: "Market Cap" },
    { id: "price", label: "Price" },
    { id: "change24h", label: "24h Change" },
    { id: "change7d", label: "7d Change" },
    { id: "name", label: "Name" },
];

export default function TokenFilters({
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
    className
}: TokenFiltersProps) {

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
                                    ? "bg-white/[0.08] text-white border border-white/[0.2]"
                                    : "text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent"
                            )}
                        >
                            <span className="text-xs">{category.icon}</span>
                            {category.label}
                        </button>
                    ))}
                </div>

                {/* Minimal sort & actions */}
                <div className="flex items-center gap-4">
                    {/* Clean sort selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-white/40">Sort by</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-transparent border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/[0.3] transition-colors duration-200"
                        >
                            {sortOptions.map((option) => (
                                <option key={option.id} value={option.id} className="bg-black text-white">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subtle action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="p-2 rounded-xl hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-all duration-200"
                            title="Export data"
                        >
                            <Download className="h-4 w-4" />
                        </button>

                        <button
                            className="p-2 rounded-xl hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-all duration-200"
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