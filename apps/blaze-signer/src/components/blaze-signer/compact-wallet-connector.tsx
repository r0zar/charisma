"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@repo/ui/button"
import { connect } from "@stacks/connect"
import type { AddressEntry } from "@stacks/connect/dist/types/methods"
import { cn } from "@repo/ui/utils"

interface CompactWalletConnectorProps {
    onWalletUpdate: (status: {
        connected: boolean
        address: string
        publicKey: string
    }) => void
    className?: string
}

export function CompactWalletConnector({ onWalletUpdate, className }: CompactWalletConnectorProps) {
    const [isConnecting, setIsConnecting] = useState(false)
    const [walletConnected, setWalletConnected] = useState(false)
    const [walletAddress, setWalletAddress] = useState("")
    const [walletPublicKey, setWalletPublicKey] = useState("")

    // Check if user is already authenticated on component mount
    useEffect(() => {
        const addresses: AddressEntry[] = JSON.parse(localStorage.getItem('addresses') || '[]')
        if (addresses.length) {
            const mainnetAddress = addresses[2].address
            const publicKey = addresses[2].publicKey || ""
            setWalletConnected(true)
            setWalletAddress(mainnetAddress)
            setWalletPublicKey(publicKey)
            onWalletUpdate({
                connected: true,
                address: mainnetAddress,
                publicKey
            })
        }
    }, [onWalletUpdate])

    // Function to connect wallet using Stacks Connect
    const connectWallet = async () => {
        setIsConnecting(true)
        try {
            const result = await connect()
            localStorage.setItem('addresses', JSON.stringify(result.addresses))

            const mainnetAddress = result.addresses[2].address
            const publicKey = result.addresses[2].publicKey || ""

            setWalletConnected(true)
            setWalletAddress(mainnetAddress)
            setWalletPublicKey(publicKey)
            onWalletUpdate({
                connected: true,
                address: mainnetAddress,
                publicKey
            })
        } catch (error) {
            console.error('Failed to connect wallet:', error)
        } finally {
            setIsConnecting(false)
        }
    }

    // Function to disconnect wallet
    const disconnectWallet = () => {
        localStorage.removeItem('addresses')
        setWalletAddress("")
        setWalletPublicKey("")
        setWalletConnected(false)
        onWalletUpdate({
            connected: false,
            address: "",
            publicKey: ""
        })
    }

    return (
        <div className={cn("flex justify-end", className)}>
            {walletConnected ? (
                <div className="flex items-center gap-2">
                    <div className="px-2 py-1 bg-muted rounded-md">
                        <span className="text-xs font-medium">
                            {`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        onClick={disconnectWallet}
                        size="sm"
                        className="h-8 px-3"
                    >
                        Logout
                    </Button>
                </div>
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
                            ...
                        </>
                    ) : (
                        "Connect"
                    )}
                </Button>
            )}
        </div>
    )
} 