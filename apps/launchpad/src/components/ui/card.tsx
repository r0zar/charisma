import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> { }

const Card = ({ className, ...props }: CardProps) => (
    <div
        className={cn(
            "rounded-lg border border-border bg-background text-foreground shadow-sm",
            className
        )}
        {...props}
    />
)
Card.displayName = "Card"

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> { }

const CardHeader = ({ className, ...props }: CardHeaderProps) => (
    <div
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
)
CardHeader.displayName = "CardHeader"

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> { }

const CardTitle = ({ className, ...props }: CardTitleProps) => (
    <h3
        className={cn(
            "text-2xl font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
)
CardTitle.displayName = "CardTitle"

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> { }

const CardDescription = ({ className, ...props }: CardDescriptionProps) => (
    <p
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
)
CardDescription.displayName = "CardDescription"

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> { }

const CardContent = ({ className, ...props }: CardContentProps) => (
    <div className={cn("p-6 pt-0", className)} {...props} />
)
CardContent.displayName = "CardContent"

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> { }

const CardFooter = ({ className, ...props }: CardFooterProps) => (
    <div
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } 