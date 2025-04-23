import * as React from "react"
import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
        />
    )
}

export function SkeletonCard() {
    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <div className="h-48 bg-muted" />
            <div className="p-6 space-y-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="pt-4">
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        </div>
    )
} 