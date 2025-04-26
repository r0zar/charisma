import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"

// --- Copied formatBalance helper --- (Move to utils later if preferred)
function formatBalance(balanceStr: string | null | undefined, decimals: number | undefined): string {
    if (balanceStr === null || balanceStr === undefined) return "N/A";
    // Default to 6 decimals if not provided or invalid
    const dec = (typeof decimals === 'number' && decimals >= 0) ? decimals : 6;

    // Handle zero decimals case
    if (dec === 0) return balanceStr;

    try {
        // Ensure it's a non-negative integer string
        if (!/^\d+$/.test(balanceStr)) return balanceStr; // Return as is if not a simple integer string

        const len = balanceStr.length;

        if (len <= dec) {
            // Pad with leading zeros if balance length is less than or equal to decimals
            return `0.${balanceStr.padStart(dec, '0')}`;
        } else {
            // Insert decimal point
            const integerPart = balanceStr.slice(0, len - dec);
            const fractionalPart = balanceStr.slice(len - dec);
            return `${integerPart}.${fractionalPart}`;
        }
    } catch (e) {
        console.error(`Error formatting balance ${balanceStr} with ${dec} decimals:`, e);
        return balanceStr; // Return original string on error
    }
}
// --- End formatBalance helper ---

interface BalanceDisplayProps {
    contractId: string
    walletAddress: string
    tokenSymbol: string
    decimals?: number
}

export function BalanceDisplay({
    contractId,
    walletAddress,
    tokenSymbol,
    decimals = 6
}: BalanceDisplayProps) {
    const [balance, setBalance] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchBalance = async () => {
        if (!walletAddress || !contractId) return

        setIsLoading(true)
        setError(null)

        // Construct relative URL to the API endpoint
        const apiUrl = `/api/balances/${contractId}/${walletAddress}`
        console.log(`BalanceDisplay: Fetching from ${apiUrl}`)

        try {
            const response = await fetch(apiUrl, { cache: 'no-store' })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) // Try to get error details
                throw new Error(errorData.error || `API Error: ${response.status}`)
            }

            const data = await response.json()

            // Check if the expected field exists
            if (data.preconfirmationBalance !== undefined && data.preconfirmationBalance !== null) {
                // Format the raw preconfirmation balance string using decimals
                const formattedBalance = formatBalance(data.preconfirmationBalance, decimals)
                setBalance(formattedBalance)
            } else {
                // Handle case where API might return null/undefined even on success (e.g., no balance entry)
                console.warn(`BalanceDisplay: API success but preconfirmationBalance missing or null for ${walletAddress} / ${contractId}`)
                setBalance(formatBalance("0", decimals)) // Display 0 if missing
            }
        } catch (error) {
            console.error("Error fetching balance via API:", error)
            setError(error instanceof Error ? error.message : String(error))
            setBalance(null)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (walletAddress && contractId) {
            fetchBalance()
        } else {
            setBalance(null)
            setError(null)
        }
        // Depend on decimals as well, in case it changes
    }, [walletAddress, contractId, decimals])

    return (
        <Card className="p-6">
            {isLoading ? (
                <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : error ? (
                <div className="text-center text-destructive">
                    Error loading balance: {error}
                </div>
            ) : (
                <>
                    <div className="text-2xl font-bold">
                        {balance === null ? "-.--" : balance} {tokenSymbol}
                    </div>
                    <div className="text-sm text-muted-foreground">Current Balance</div>
                </>
            )}
        </Card>
    )
} 