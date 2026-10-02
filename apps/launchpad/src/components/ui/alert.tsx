import * as React from "react"
import { cn } from "@/lib/utils"

const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        variant?: "default" | "destructive" | "info" | "warning" | "success";
    }
>(({ className, variant = "default", ...props }, ref) => {
    const variantClasses = {
        default: "bg-surface text-foreground",
        destructive: "bg-destructive/15 text-destructive border-destructive/50",
        info: "bg-accent/15 text-accent-text border-accent/50",
        warning: "bg-warning/15 text-warning border-warning/50",
        success: "bg-success/15 text-success border-success/50"
    }

    return (
        <div
            ref={ref}
            role="alert"
            className={cn(
 "relative w-full rounded-lg border p-4",
                variantClasses[variant],
                className
            )}
            {...props}
        />
    )
}) as any
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h5
        ref={ref}
        className={cn("mb-1 font-medium leading-none tracking-tight", className)}
        {...props}
    />
)) as any
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("text-sm", className)}
        {...props}
    />
)) as any
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }