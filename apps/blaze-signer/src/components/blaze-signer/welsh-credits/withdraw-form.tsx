"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    uintCV,
    someCV,
    noneCV,
    principalCV,
    Pc
} from "@stacks/transactions"
import { Loader2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"
import { Button } from "@repo/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/card"
import { cn } from "@repo/ui/utils"
import {
    WELSHCORGICOIN_CONTRACT,
    WELSH_CREDITS_CONTRACT,
    WELSH_CREDITS_DECIMALS,
    parseContract
} from "../../../constants/contracts"

interface WithdrawFormProps {
    network: StacksNetwork
    isWalletConnected: boolean
    onSuccess: () => void
    className?: string
}

type FunctionResult = {
    type: 'success' | 'error'
    message: string
}

export function WithdrawForm({
    network,
    isWalletConnected,
    onSuccess,
    className
}: WithdrawFormProps) {
    // Withdraw state
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [withdrawRecipient, setWithdrawRecipient] = useState("")
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [withdrawResult, setWithdrawResult] = useState<FunctionResult | null>(null)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Handle withdraw
    const handleWithdraw = async () => {
        if (!isWalletConnected || !withdrawAmount) {
            setWithdrawResult({
                type: 'error',
                message: 'Please connect wallet and enter an amount'
            })
            return
        }

        setIsWithdrawing(true)
        setWithdrawResult(null)

        try {
            // Parse contract address and name
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)

            // Convert amount to micros (consider decimal places)
            const amountInMicros = Math.floor(parseFloat(withdrawAmount) * Math.pow(10, WELSH_CREDITS_DECIMALS))

            // Prepare recipient argument
            const recipientArg = withdrawRecipient.trim() !== ''
                ? someCV(principalCV(withdrawRecipient))
                : noneCV()

            // Call the withdraw function
            await request('stx_callContract', {
                contract: `${contractAddress}.${contractName}`,
                functionName: "withdraw",
                functionArgs: [
                    uintCV(amountInMicros),
                    recipientArg
                ],
                postConditionMode: 'deny',
                postConditions: [
                    Pc.principal(WELSH_CREDITS_CONTRACT).willSendEq(amountInMicros).ft(WELSHCORGICOIN_CONTRACT, 'welshcorgicoin')
                ]
            })

            // Set result after successful transaction
            setWithdrawResult({
                type: 'success',
                message: 'Withdraw transaction submitted'
            })

            // Call the success callback
            setTimeout(onSuccess, 3000)

        } catch (error) {
            console.error("Error withdrawing:", error)
            setWithdrawResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsWithdrawing(false)
        }
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Withdraw</CardTitle>
                <CardDescription>
                    Withdraw WELSH tokens from this contract
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="withdraw-amount" className="block text-sm font-medium text-foreground">Amount</label>
                        <input
                            id="withdraw-amount"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter amount (e.g. 10.5)"
                            value={withdrawAmount}
                            onChange={handleInputChange(setWithdrawAmount)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="withdraw-recipient" className="block text-sm font-medium text-foreground">
                            Recipient (Optional)
                        </label>
                        <input
                            id="withdraw-recipient"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Leave empty to withdraw to your own account"
                            value={withdrawRecipient}
                            onChange={handleInputChange(setWithdrawRecipient)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !isWalletConnected || !withdrawAmount}
                    >
                        {isWithdrawing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Withdrawing...
                            </>
                        ) : (
                            "Withdraw"
                        )}
                    </Button>

                    {withdrawResult && (
                        <div className="mt-4 p-4 rounded-md border border-border">
                            <p className="text-sm font-medium mb-1">Result</p>
                            <div className="font-mono text-sm break-all">
                                <span className={withdrawResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {withdrawResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 