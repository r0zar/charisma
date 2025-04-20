"use client"

import React, { useState, ChangeEvent, useEffect } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    fetchCallReadOnlyFunction,
    principalCV,
    ClarityType
} from "@stacks/transactions"
import {
    WELSH_CREDITS_CONTRACT,
    WELSH_CREDITS_DECIMALS,
    parseContract
} from "../../../constants/contracts"
import { cn } from "@repo/ui/utils"
import { TokenInfo } from './token-info'
import { BalanceDisplay } from './balance-display'
import { DepositForm } from './deposit-form'
import { WithdrawForm } from './withdraw-form'
import { TransferForm } from './transfer-form'
import { RedeemNoteForm } from './redeem-note-form'
import { BatchRedeemForm } from './batch-redeem-form'

interface WelshCreditsInterfaceProps {
    network: StacksNetwork
    walletAddress: string
    isWalletConnected: boolean
    className?: string
}

export function WelshCreditsInterface({
    network,
    walletAddress,
    isWalletConnected,
    className
}: WelshCreditsInterfaceProps) {
    // Account balance
    const [balance, setBalance] = useState<string | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)

    // Load user balance when wallet changes
    useEffect(() => {
        if (walletAddress) {
            fetchBalance()
        } else {
            setBalance(null)
        }
    }, [walletAddress])

    // Fetch user balance
    const fetchBalance = async () => {
        if (!walletAddress) return

        setIsLoadingBalance(true)

        try {
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)

            const result = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "get-balance",
                functionArgs: [principalCV(walletAddress)],
                network,
                senderAddress: walletAddress,
            })

            if (result && typeof result === 'object' && 'value' in result && typeof result.value === 'bigint') {
                // Format with decimal places
                const rawBalance = Number(result.value)
                const formattedBalance = (rawBalance / Math.pow(10, WELSH_CREDITS_DECIMALS)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: WELSH_CREDITS_DECIMALS
                })
                setBalance(formattedBalance)
            } else {
                setBalance("0.00") // Assume 0 if balance is not found or invalid
            }
        } catch (error) {
            console.error("Error fetching balance:", error)
            setBalance("Error")
        } finally {
            setIsLoadingBalance(false)
        }
    }

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", className)}>
            <TokenInfo network={network} className="md:col-span-1" />
            <BalanceDisplay
                walletAddress={walletAddress}
                balance={balance}
                isLoading={isLoadingBalance}
                onRefresh={fetchBalance}
                className="md:col-span-1"
            />
            <DepositForm
                network={network}
                isWalletConnected={isWalletConnected}
                onSuccess={fetchBalance}
            />
            <WithdrawForm
                network={network}
                isWalletConnected={isWalletConnected}
                onSuccess={fetchBalance}
            />
            <TransferForm
                network={network}
                walletAddress={walletAddress}
                isWalletConnected={isWalletConnected}
                onSuccess={fetchBalance}
            />
        </div>
    )
} 