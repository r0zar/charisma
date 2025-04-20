"use client"

import React from "react"
import { Loader2 } from "@repo/ui/icons"
import { Button } from "@repo/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/card"
import { cn } from "@repo/ui/utils"

interface BalanceDisplayProps {
    walletAddress: string
    balance: string | null
    isLoading: boolean
    onRefresh: () => void
    className?: string
}

export function BalanceDisplay({
    walletAddress,
    balance,
    isLoading,
    onRefresh,
    className
}: BalanceDisplayProps) {
    const isRefreshDisabled = isLoading || !walletAddress;

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Welsh Credits Manager</CardTitle>
                <CardDescription>
                    Interact with the Welsh Credits contract to manage your tokens
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Connected Wallet</label>
                        <input
                            className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed"
                            style={{ opacity: walletAddress ? 1 : 0.7 }}
                            value={walletAddress || "Not connected"}
                            disabled
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Your Balance</label>
                        <div className="flex items-center gap-2">
                            <div className="flex-grow p-3 rounded-md border border-border bg-background">
                                <div className="min-h-6">
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Loading...</span>
                                        </div>
                                    ) : balance === null ? (
                                        "Connect wallet to view balance"
                                    ) : balance === "Error" ? (
                                        <span className="text-destructive">Error loading balance</span>
                                    ) : (
                                        <span className="text-primary">{balance} WELSH</span>
                                    )}
                                </div>
                            </div>
                            {walletAddress && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onRefresh}
                                    disabled={isRefreshDisabled}
                                >
                                    Refresh
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
} 