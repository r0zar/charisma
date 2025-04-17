"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@repo/ui/button"
import { connect } from "@stacks/connect"
import type { AddressEntry } from "@stacks/connect/dist/types/methods"

interface WalletConnectorProps {
    onWalletUpdate: (status: {
        connected: boolean
        address: string
        publicKey: string
    }) => void
    // Add a className prop to allow styling from parent
    className?: string;
}

// Basic styling for the wallet connector section
const styles = {
    container: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '1.5rem', // mb-6
    },
    connectedContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem', // gap-2
    },
    addressBox: {
        padding: '0.5rem 0.75rem', // px-3 py-2
        backgroundColor: '#f3f4f6', // bg-muted (example, adjust as needed)
        borderRadius: '0.375rem', // rounded-md
    },
    addressText: {
        fontSize: '0.875rem', // text-sm
        fontWeight: 500, // font-medium
    },
    loader: {
        display: 'inline-block',
        width: '1rem',
        height: '1rem',
        marginRight: '0.5rem',
        border: '2px solid #f3f4f6',
        borderTopColor: '#000',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' },
    }
};

// Function to inject keyframes (only needs to be done once)
let keyframesInjected = false;
const injectKeyframes = () => {
    if (typeof document !== 'undefined' && !keyframesInjected) {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(styleSheet);
        keyframesInjected = true;
    }
};


export function WalletConnector({ onWalletUpdate, className }: WalletConnectorProps) {
    const [isConnecting, setIsConnecting] = useState(false)
    const [walletConnected, setWalletConnected] = useState(false)
    const [walletAddress, setWalletAddress] = useState("")
    const [walletPublicKey, setWalletPublicKey] = useState("")

    // Inject keyframes for spinner animation
    useEffect(() => {
        injectKeyframes();
    }, []);

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
        <div style={styles.container} className={className}>
            {walletConnected ? (
                <div style={styles.connectedContainer}>
                    <div style={styles.addressBox}>
                        <span style={styles.addressText}>
                            {`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}
                            {walletPublicKey && <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>({walletPublicKey.substring(0, 4)})</span>}
                        </span>
                    </div>
                    <Button variant="outline" onClick={disconnectWallet}>
                        Disconnect
                    </Button>
                </div>
            ) : (
                <Button onClick={connectWallet} disabled={isConnecting}>
                    {isConnecting ? (
                        <>
                            <div style={styles.loader} />
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