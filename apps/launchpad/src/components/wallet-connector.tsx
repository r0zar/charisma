"use client"

import React, { useEffect } from "react"
import { Button } from "@/components/ui/button"
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

export function WalletConnector({ className }: { className?: string }) {
    const { walletState, connectWallet, disconnectWallet } = useApp();
    const { connected, address } = walletState;

    // Debug the wallet state
    useEffect(() => {
        console.log("WalletConnector state:", { connected, address });
    }, [connected, address]);

    return (
        <div className={cn("flex items-center relative z-50", className)}>
            {!connected ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log("Connect button clicked");
                        connectWallet();
                    }}
                    className="text-xs relative z-50 cursor-pointer"
                >
                    Connect Wallet
                </Button>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log("Disconnect button clicked");
                        disconnectWallet();
                    }}
                    className="text-xs bg-muted/50 relative z-50 cursor-pointer"
                >
                    {address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : "Connected"}
                </Button>
            )}
        </div>
    )
} 