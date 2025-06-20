import React from "react";

export default function TokenDetailSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header skeleton */}
            <div className="flex items-start justify-between gap-4 mb-6">
                {/* token info */}
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-muted/30 animate-pulse shimmer" />
                    <div>
                        <div className="h-7 w-40 bg-muted/30 rounded animate-pulse shimmer mb-2" />
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-16 bg-muted/20 rounded animate-pulse shimmer" />
                            <div className="h-3 w-20 bg-muted/15 rounded animate-pulse shimmer" />
                        </div>
                    </div>
                </div>

                {/* selector skeleton */}
                <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted/20 rounded animate-pulse shimmer" />
                    <div className="flex gap-2">
                        <div className="h-10 w-40 bg-muted/20 rounded animate-pulse shimmer" />
                        <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-10 w-10 bg-muted/20 rounded animate-pulse shimmer" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats row skeleton */}
            <div className="grid grid-cols-4 gap-4 mb-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg bg-muted/20">
                        <div className="h-3 w-12 bg-muted/30 rounded animate-pulse shimmer mb-2" />
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-20 bg-muted/30 rounded animate-pulse shimmer" />
                            {i > 0 && <div className="h-3 w-3 bg-muted/25 rounded animate-pulse shimmer" />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart skeleton with more realistic shape */}
            <div className="mb-8">
                <div className="h-96 bg-muted/20 rounded-xl relative overflow-hidden">
                    {/* Chart lines simulation */}
                    <div className="absolute inset-4">
                        <div className="grid grid-cols-12 gap-2 h-full">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="flex flex-col justify-end">
                                    <div 
                                        className="bg-muted/40 rounded-t animate-pulse shimmer"
                                        style={{ height: `${20 + Math.random() * 60}%` }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Loading text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                            Loading chart data...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Add shimmer effect via CSS */
const shimmerCSS = `
@keyframes shimmer {
  0% {
    background-position: -468px 0;
  }
  100% {
    background-position: 468px 0;
  }
}

.shimmer {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  background-size: 468px 100%;
  animation: shimmer 1.5s infinite;
}
`;

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = shimmerCSS;
    document.head.appendChild(style);
} 