"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    uintCV,
    someCV,
    noneCV,
    principalCV,
    stringAsciiCV,
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

interface TransferFormProps {
    network: StacksNetwork
    walletAddress: string
    isWalletConnected: boolean
    onSuccess: () => void
    className?: string
}

type FunctionResult = {
    type: 'success' | 'error'
    message: string
}

export function TransferForm({
    network,
    walletAddress,
    isWalletConnected,
    onSuccess,
    className
}: TransferFormProps) {
    // Transfer state
    const [transferAmount, setTransferAmount] = useState("")
    const [transferTo, setTransferTo] = useState("")
    const [transferMemo, setTransferMemo] = useState("")
    const [isTransferring, setIsTransferring] = useState(false)
    const [transferResult, setTransferResult] = useState<FunctionResult | null>(null)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Handle transfer
    const handleTransfer = async () => {
        if (!isWalletConnected || !transferAmount || !transferTo) {
            setTransferResult({
                type: 'error',
                message: 'Please connect wallet, enter an amount, and specify a recipient'
            })
            return
        }

        setIsTransferring(true)
        setTransferResult(null)

        try {
            // Parse contract address and name
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)

            // Convert amount to micros (consider decimal places)
            const amountInMicros = Math.floor(parseFloat(transferAmount) * Math.pow(10, WELSH_CREDITS_DECIMALS))

            // Prepare memo argument - the memo should be a string-ascii
            const memoArg = transferMemo.trim() !== ''
                ? someCV(stringAsciiCV(transferMemo))
                : noneCV()

            // Call the transfer function
            await request('stx_callContract', {
                contract: `${contractAddress}.${contractName}`,
                functionName: "transfer",
                functionArgs: [
                    uintCV(amountInMicros),
                    principalCV(walletAddress),
                    principalCV(transferTo),
                    memoArg
                ],
                postConditionMode: 'deny'
            })

            // Set result after successful transaction
            setTransferResult({
                type: 'success',
                message: 'Transfer transaction submitted'
            })

            // Call the success callback
            setTimeout(onSuccess, 3000)

        } catch (error) {
            console.error("Error transferring:", error)
            setTransferResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsTransferring(false)
        }
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Transfer</CardTitle>
                <CardDescription>
                    Transfer credits to another account within the contract
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="transfer-amount" className="block text-sm font-medium text-foreground">Amount</label>
                        <input
                            id="transfer-amount"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter amount (e.g. 10.5)"
                            value={transferAmount}
                            onChange={handleInputChange(setTransferAmount)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="transfer-to" className="block text-sm font-medium text-foreground">Recipient</label>
                        <input
                            id="transfer-to"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter recipient address"
                            value={transferTo}
                            onChange={handleInputChange(setTransferTo)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="transfer-memo" className="block text-sm font-medium text-foreground">
                            Memo (Optional)
                        </label>
                        <input
                            id="transfer-memo"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter an optional memo"
                            value={transferMemo}
                            onChange={handleInputChange(setTransferMemo)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleTransfer}
                        disabled={isTransferring || !isWalletConnected || !transferAmount || !transferTo}
                    >
                        {isTransferring ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Transferring...
                            </>
                        ) : (
                            "Transfer"
                        )}
                    </Button>

                    {transferResult && (
                        <div className="mt-4 p-4 rounded-md border border-border">
                            <p className="text-sm font-medium mb-1">Result</p>
                            <div className="font-mono text-sm break-all">
                                <span className={transferResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {transferResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 