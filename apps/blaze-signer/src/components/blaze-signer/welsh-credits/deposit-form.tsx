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

interface DepositFormProps {
    network: StacksNetwork
    isWalletConnected: boolean
    onSuccess: () => void
    className?: string
}

type FunctionResult = {
    type: 'success' | 'error'
    message: string
}

export function DepositForm({
    network,
    isWalletConnected,
    onSuccess,
    className
}: DepositFormProps) {
    // Deposit state
    const [depositAmount, setDepositAmount] = useState("")
    const [depositRecipient, setDepositRecipient] = useState("")
    const [isDepositing, setIsDepositing] = useState(false)
    const [depositResult, setDepositResult] = useState<FunctionResult | null>(null)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Handle deposit
    const handleDeposit = async () => {
        if (!isWalletConnected || !depositAmount) {
            setDepositResult({
                type: 'error',
                message: 'Please connect wallet and enter an amount'
            })
            return
        }

        setIsDepositing(true)
        setDepositResult(null)

        try {
            // Parse contract address and name
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)

            // Convert amount to micros (consider decimal places)
            const amountInMicros = Math.floor(parseFloat(depositAmount) * Math.pow(10, WELSH_CREDITS_DECIMALS))

            // Prepare recipient argument
            const recipientArg = depositRecipient.trim() !== ''
                ? someCV(principalCV(depositRecipient))
                : noneCV()

            // Call the deposit function
            await request('stx_callContract', {
                contract: `${contractAddress}.${contractName}`,
                functionName: "deposit",
                functionArgs: [
                    uintCV(amountInMicros),
                    recipientArg
                ],
                postConditionMode: 'deny',
                postConditions: [
                    Pc.origin().willSendEq(amountInMicros).ft(WELSHCORGICOIN_CONTRACT, 'welshcorgicoin')
                ]
            })

            // Set result after successful transaction
            setDepositResult({
                type: 'success',
                message: 'Deposit transaction submitted'
            })

            // Call the success callback
            setTimeout(onSuccess, 3000)

        } catch (error) {
            console.error("Error depositing:", error)
            setDepositResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsDepositing(false)
        }
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Deposit</CardTitle>
                <CardDescription>
                    Deposit WELSH tokens to this contract
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="deposit-amount" className="block text-sm font-medium text-foreground">Amount</label>
                        <input
                            id="deposit-amount"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter amount (e.g. 10.5)"
                            value={depositAmount}
                            onChange={handleInputChange(setDepositAmount)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="deposit-recipient" className="block text-sm font-medium text-foreground">
                            Recipient (Optional)
                        </label>
                        <input
                            id="deposit-recipient"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Leave empty to deposit to your own account"
                            value={depositRecipient}
                            onChange={handleInputChange(setDepositRecipient)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleDeposit}
                        disabled={isDepositing || !isWalletConnected || !depositAmount}
                    >
                        {isDepositing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Depositing...
                            </>
                        ) : (
                            "Deposit"
                        )}
                    </Button>

                    {depositResult && (
                        <div className="mt-4 p-4 rounded-md border border-border">
                            <p className="text-sm font-medium mb-1">Result</p>
                            <div className="font-mono text-sm break-all">
                                <span className={depositResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {depositResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 