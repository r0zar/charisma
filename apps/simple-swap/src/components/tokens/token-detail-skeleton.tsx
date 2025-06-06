import React from "react";

export default function TokenDetailSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header skeleton */}
            <div className="flex items-start justify-between gap-4">
                {/* token info */}
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-muted/30 animate-pulse" />
                    <div>
                        <div className="h-6 w-32 bg-muted/30 rounded animate-pulse mb-2" />
                        <div className="h-4 w-16 bg-muted/20 rounded animate-pulse" />
                    </div>
                </div>

                {/* selector skeleton */}
                <div className="h-10 w-48 bg-muted/20 rounded animate-pulse" />
            </div>

            {/* Stats row skeleton */}
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg bg-muted/20 animate-pulse">
                        <div className="h-3 w-8 bg-muted/30 rounded mb-2" />
                        <div className="h-5 w-16 bg-muted/30 rounded" />
                    </div>
                ))}
            </div>

            {/* Chart skeleton */}
            <div className="h-64 bg-muted/20 rounded-xl animate-pulse" />
        </div>
    );
} 