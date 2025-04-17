"use client"

import React from "react"
import { Loader2 } from "@repo/ui/icons"

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
    return (
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Welsh Credits Manager</h2>
                <p className="card-description">
                    Interact with the Welsh Credits contract to manage your tokens
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="label">Connected Wallet</label>
                        <input
                            className="input"
                            value={walletAddress || "Not connected"}
                            disabled
                            style={{
                                backgroundColor: 'var(--border)',
                                cursor: 'not-allowed',
                                opacity: walletAddress ? 1 : 0.7
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="label">Your Balance</label>
                        <div className="result-box">
                            <div className="result-box-content">
                                {isLoading ? (
                                    <div className="flex items-center">
                                        <Loader2 className="button-icon h-4 w-4 animate-spin" />
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
                            <button
                                className="button"
                                onClick={onRefresh}
                                disabled={isLoading || !walletAddress}
                            >
                                Refresh Balance
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
} 