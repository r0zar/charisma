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
        <div className={cn("space-y-4", className)}>
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                {/* Category Filters */}
                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setCategoryFilter(category.id)}
                            className={cn(
                                "inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                                categoryFilter === category.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span>{category.icon}</span>
                            {category.label}
                        </button>
                    ))}
                </div>

                {/* Sort & Actions */}
                <div className="flex items-center gap-3">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            {sortOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    Sort by {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-sm font-medium transition-colors"
                            title="Export data"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>

                        <button
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-sm font-medium transition-colors"
                            title="Watchlist"
                        >
                            <Heart className="h-4 w-4" />
                            <span className="hidden sm:inline">Watchlist</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    <span>Legend:</span>
                </div>
                <div className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-red-500" />
                    <span>Subnet Available (in Subnets column)</span>
                </div>
                <div className="text-xs">
                    • Filtered: Tokens without images and SUBNET wrapper tokens are hidden
                </div>
            </div>
        </div>
    );
} 