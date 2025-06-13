"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

// Use 'any' type to fix lint errors
const TooltipProvider = TooltipPrimitive.Provider as any

const Tooltip = TooltipPrimitive.Root as any

const TooltipTrigger = TooltipPrimitive.Trigger as any

const TooltipContent = (({ className, sideOffset = 4, ...props }: any, ref: any) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        // Ensure tooltip is rendered in a portal to avoid overflow clipping
        container={typeof window !== 'undefined' ? document.body : undefined}
        className={cn(
            "z-[9999] overflow-hidden rounded-lg bg-background border border-border px-3 py-1.5 text-sm text-foreground shadow-lg backdrop-blur-sm",
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

interface TooltipProps {
    content: string;
    children?: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
}

export function InfoTooltip({ content, children, side = "top" }: TooltipProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="cursor-help inline-flex items-center">
                        {children || <Info className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />}
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    className="max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 leading-relaxed whitespace-normal break-words"
                >
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } 