"use client"

import * as React from "react"
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

interface BalanceTooltipProps {
    mainnet: string;
    subnet?: string;
    activeLabel: string;
    children?: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
}

export function BalanceTooltip({ mainnet, subnet, activeLabel, children, side = "bottom" }: BalanceTooltipProps) {
    const hasSubnet = subnet !== undefined;
    const total = hasSubnet ? (Number(mainnet.replace(/,/g, '')) + Number(subnet.replace(/,/g, ''))).toLocaleString() : mainnet;
    
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="cursor-help inline-flex items-center">
                        {children}
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    className="px-3 py-2 text-sm"
                >
                    <div className="space-y-1">
                        {hasSubnet && (
                            <>
                                <div className="flex justify-between items-center gap-3">
                                    <span className="text-muted-foreground">Active:</span>
                                    <span className="font-medium">{activeLabel}</span>
                                </div>
                                <div className="border-t border-border/50 pt-1 space-y-1">
                                    <div className="flex justify-between items-center gap-3">
                                        <span className="text-muted-foreground">Mainnet:</span>
                                        <span className="font-mono text-xs">{mainnet}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-3">
                                        <span className="text-muted-foreground">Subnet:</span>
                                        <span className="font-mono text-xs text-purple-600 dark:text-purple-400">{subnet}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-3 pt-1 border-t border-border/30">
                                        <span className="text-muted-foreground font-medium">Total:</span>
                                        <span className="font-mono text-xs font-medium">{total}</span>
                                    </div>
                                </div>
                            </>
                        )}
                        {!hasSubnet && (
                            <div className="flex justify-between items-center gap-3">
                                <span className="text-muted-foreground">Balance:</span>
                                <span className="font-mono text-xs">{mainnet}</span>
                            </div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } 