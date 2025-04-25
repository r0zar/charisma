"use client"

import React from "react"
import { Button } from "../ui/button"
import { cn } from "../ui/utils"
import { useWallet } from "@/context/wallet-context"

interface CompactWalletConnectorProps {
    className?: string
}

export function CompactWalletConnector({ className }: CompactWalletConnectorProps) {
    const {
        connected,
        address,
        isConnecting,
        connectWallet,
        disconnectWallet
    } = useWallet()

    return (
        <div className={cn("flex justify-end", className)}>
            {connected && address ? (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={disconnectWallet}
                    className="h-8 px-3 text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title={address}
                >
                    {`${address.substring(0, 6)}...${address.substring(address.length - 4)}`}
                </Button>
            ) : (
                <Button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    size="sm"
                    className="h-8 px-3"
                >
                    {isConnecting ? (
                        <>
                            <div className="inline-block w-3 h-3 mr-1 border rounded-full animate-spin border-t-foreground border-muted" />
                            Connecting...
                        </>
                    ) : (
                        "Connect Wallet"
                    )}
                </Button>
            )}
        </div>
    )
}