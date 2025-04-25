"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { connect } from "@stacks/connect"
import type { AddressEntry } from "@stacks/connect/dist/types/methods"

type WalletStatus = {
    connected: boolean
    address: string | null
    publicKey: string | null
    isConnecting: boolean
    connectWallet: () => Promise<void>
    disconnectWallet: () => void
}

const WalletContext = createContext<WalletStatus | undefined>(undefined)

const LS_KEY = "stx-addresses"

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [isConnecting, setIsConnecting] = useState(false)
    const [address, setAddress] = useState<string | null>(null)
    const [publicKey, setPublicKey] = useState<string | null>(null)

    /* ---------- Bootstrap from localStorage ---------- */
    useEffect(() => {
        try {
            const stored: AddressEntry[] = JSON.parse(localStorage.getItem(LS_KEY) || "[]")
            // Ensure it's an array and has the expected structure before accessing index 2
            if (Array.isArray(stored) && stored.length >= 3 && stored[2]?.address) {
                setAddress(stored[2].address)
                setPublicKey(stored[2].publicKey ?? null)
            } else {
                // Clear potentially invalid data
                localStorage.removeItem(LS_KEY);
            }
        } catch (error) {
            console.error("Failed to parse wallet data from localStorage:", error);
            // Clear potentially invalid data on error
            localStorage.removeItem(LS_KEY);
        }
    }, [])

    /* ---------- Actions ---------- */
    const connectWallet = useCallback(async () => {
        setIsConnecting(true)
        try {
            // User Authentication happens here
            const result = await connect()
            // TODO: Add better error handling and user feedback for connect() promise rejection

            // Assuming 'addresses' is always an array in the result
            // and the desired address is at index 2 (Mainnet)
            if (result?.addresses && result.addresses.length >= 3 && result.addresses[2]?.address) {
                localStorage.setItem(LS_KEY, JSON.stringify(result.addresses))
                setAddress(result.addresses[2].address)
                setPublicKey(result.addresses[2].publicKey ?? null)
            } else {
                console.error("Unexpected result structure from connect():", result);
                // Optionally clear state if connection result is invalid
                setAddress(null);
                setPublicKey(null);
                localStorage.removeItem(LS_KEY);
            }
        } catch (error) {
            // Handle errors, e.g., user cancelling the connection modal
            console.error('Wallet connection failed or cancelled:', error);
            // Ensure state reflects disconnected status if connection fails
            setAddress(null);
            setPublicKey(null);
            localStorage.removeItem(LS_KEY);
        }
        finally {
            setIsConnecting(false)
        }
    }, [])

    const disconnectWallet = useCallback(() => {
        localStorage.removeItem(LS_KEY)
        setAddress(null)
        setPublicKey(null)
    }, [])

    /* ---------- Memoised value ---------- */
    // Ensure the value object always has the correct shape
    const value: WalletStatus = {
        connected: !!address && !!publicKey, // Consider connected only if both address and publicKey are present
        address,
        publicKey,
        isConnecting,
        connectWallet,
        disconnectWallet,
    }

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

/* ---------- Hook ---------- */
export function useWallet() {
    const ctx = useContext(WalletContext)
    if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>")
    return ctx
} 