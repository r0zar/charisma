"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number
    indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
    ({ className, value = 0, indicatorClassName, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
                className
            )}
            {...props}
        >
            <div
                className={cn(
                    "h-full bg-primary transition-all duration-300 ease-in-out",
                    indicatorClassName
                )}
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
        </div>
    )
)
Progress.displayName = "Progress"

export { Progress } 