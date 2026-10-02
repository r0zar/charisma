"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/context/app-context"

// Export these types for other components that might need them
export interface WalletContextState {
    connected: boolean
    address: string
    publicKey: string
}

export interface SignatureResponse {
    signature: string
    publicKey: string
}

/** Header wallet button: the accent CTA to connect; once connected, a quiet outline on chrome with the address */
export function WalletConnector({ className }: { className?: string }) {
    const { walletState, connectWallet, disconnectWallet } = useApp();
    const { connected, address } = walletState;

    return (
        <div className={cn("flex items-center", className)}>
            {!connected ? (
                <button
                    onClick={() => connectWallet()}
                    className="h-9 px-4 sm:min-w-[140px] sm:px-5 rounded-xl bg-accent text-on-accent text-sm font-semibold shadow-[var(--shadow-cta)] hover:bg-accent-hover active:scale-[0.98] transition-all duration-200"
                >
                    Connect wallet
                </button>
            ) : (
                <button
                    onClick={() => disconnectWallet()}
                    title="Disconnect"
                    className="h-9 px-3 sm:min-w-[140px] sm:px-4 rounded-xl border border-on-chrome-muted/40 text-on-chrome hover:border-on-chrome transition-all duration-200 flex items-center justify-center gap-2 font-mono text-[13px]"
                >
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                    {address ? `${address.substring(0, 5)}…${address.substring(address.length - 4)}` : "Connected"}
                </button>
            )}
        </div>
    )
}
