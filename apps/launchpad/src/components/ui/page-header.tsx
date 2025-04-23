import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps {
    title: string
    description?: string
    className?: string
    children?: React.ReactNode
}

export function PageHeader({
    title,
    description,
    className,
    children,
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col space-y-2", className)}>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
                <p className="text-muted-foreground text-lg">{description}</p>
            )}
            {children}
        </div>
    )
} 