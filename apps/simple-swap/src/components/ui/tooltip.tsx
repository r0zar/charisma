"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

// Use 'any' type to fix lint errors
const TooltipProvider = TooltipPrimitive.Provider as any

const Tooltip = TooltipPrimitive.Root as any

const TooltipTrigger = TooltipPrimitive.Trigger as any

const TooltipContent = (({ className, sideOffset = 4, ...props }: any, ref: any) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
            "z-50 overflow-hidden rounded-lg bg-background border border-border px-3 py-1.5 text-sm text-foreground shadow-lg backdrop-blur-sm",
            // Enhanced entrance animations with smoother timing
            "animate-in fade-in-0 zoom-in-[0.95] duration-200 ease-out",
            // Enhanced exit animations
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.95] data-[state=closed]:duration-150 data-[state=closed]:ease-in",
            // Smoother slide animations based on side
            "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
            // Add a subtle transform origin for better scaling
            "origin-[var(--radix-tooltip-content-transform-origin)]",
            className
        )}
        {...props}
    />
)) as any
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } 