import React, { useState, useEffect } from "react"
import { STACKS_MAINNET } from "@stacks/network"
import { fetchCallReadOnlyFunction, standardPrincipalCV } from "@stacks/transactions"
import { Card } from "@/components/ui/card"

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
        if (!walletAddress) return

        setIsLoading(true)
        setError(null)

        try {
            const [contractAddress, contractName] = contractId.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid contract format")
            }

            const result: any = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "get-balance",
                functionArgs: [standardPrincipalCV(walletAddress)],
                network: STACKS_MAINNET,
                senderAddress: walletAddress,
            })

            if (result?.value?.value) {
                const formattedBalance = (Number(result.value.value) / Math.pow(10, decimals)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: decimals
                })
                setBalance(formattedBalance)
            } else {
                setBalance("0.00")
            }
        } catch (error) {
            console.error("Error fetching balance:", error)
            setError(error instanceof Error ? error.message : String(error))
            setBalance(null)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (walletAddress) {
            fetchBalance()
        } else {
            setBalance(null)
            setError(null)
        }
    }, [walletAddress, contractId])

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