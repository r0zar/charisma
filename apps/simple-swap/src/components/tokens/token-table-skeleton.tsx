import React from "react";

export function TokenTableSkeleton() {
    return (
        <div className="w-full">
            {/* Search skeleton */}
            <div className="mb-6">
                <div className="relative w-full">
                    <div className="w-full h-12 rounded-lg border border-input bg-muted/20 animate-pulse" />
                </div>
            </div>

            {/* Header skeleton */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                    <div className="h-8 w-32 bg-muted/30 rounded animate-pulse mb-2" />
                    <div className="h-4 w-64 bg-muted/20 rounded animate-pulse" />
                </div>
                <div className="h-10 w-48 bg-muted/20 rounded animate-pulse" />
            </div>

            {/* Table skeleton */}
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="p-4 text-left sticky left-0 bg-muted z-10 w-[14rem]">
                                <div className="h-4 w-16 bg-muted-foreground/20 rounded animate-pulse" />
                            </th>
                            <th className="p-4 text-right">
                                <div className="h-4 w-12 bg-muted-foreground/20 rounded animate-pulse ml-auto" />
                            </th>
                            <th className="p-4 text-right">
                                <div className="h-4 w-8 bg-muted-foreground/20 rounded animate-pulse ml-auto" />
                            </th>
                            <th className="p-4 text-right">
                                <div className="h-4 w-10 bg-muted-foreground/20 rounded animate-pulse ml-auto" />
                            </th>
                            <th className="p-4 text-right">
                                <div className="h-4 w-8 bg-muted-foreground/20 rounded animate-pulse ml-auto" />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                                {/* Token */}
                                <td className="p-4 flex items-center gap-3 sticky left-0 bg-card z-10 w-[14rem]">
                                    <div className="h-8 w-8 rounded-full bg-muted/30 animate-pulse" />
                                    <div className="min-w-0">
                                        <div className="h-4 w-24 bg-muted/30 rounded animate-pulse mb-1" />
                                        <div className="h-3 w-12 bg-muted/20 rounded animate-pulse" />
                                    </div>
                                </td>
                                {/* Price */}
                                <td className="p-4 text-right">
                                    <div className="h-4 w-16 bg-muted/30 rounded animate-pulse ml-auto" />
                                </td>
                                {/* 1h */}
                                <td className="p-4 text-right">
                                    <div className="h-4 w-12 bg-muted/30 rounded animate-pulse ml-auto" />
                                </td>
                                {/* 24h */}
                                <td className="p-4 text-right">
                                    <div className="h-4 w-12 bg-muted/30 rounded animate-pulse ml-auto" />
                                </td>
                                {/* 7d */}
                                <td className="p-4 text-right">
                                    <div className="h-4 w-12 bg-muted/30 rounded animate-pulse ml-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
} 