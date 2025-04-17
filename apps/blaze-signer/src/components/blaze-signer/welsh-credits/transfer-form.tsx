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
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Transfer</h2>
                <p className="card-description">
                    Transfer credits to another account within the contract
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="transfer-amount" className="label">Amount</label>
                        <input
                            id="transfer-amount"
                            className="input"
                            placeholder="Enter amount (e.g. 10.5)"
                            value={transferAmount}
                            onChange={handleInputChange(setTransferAmount)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="transfer-to" className="label">Recipient</label>
                        <input
                            id="transfer-to"
                            className="input"
                            placeholder="Enter recipient address"
                            value={transferTo}
                            onChange={handleInputChange(setTransferTo)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="transfer-memo" className="label">
                            Memo (Optional)
                        </label>
                        <input
                            id="transfer-memo"
                            className="input"
                            placeholder="Enter an optional memo"
                            value={transferMemo}
                            onChange={handleInputChange(setTransferMemo)}
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleTransfer}
                        disabled={isTransferring || !isWalletConnected || !transferAmount || !transferTo}
                    >
                        {isTransferring ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Transferring...
                            </>
                        ) : (
                            "Transfer"
                        )}
                    </button>

                    {transferResult && (
                        <div className="result-box">
                            <p className="result-box-title">Result</p>
                            <div className="result-box-content">
                                <span className={transferResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {transferResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 