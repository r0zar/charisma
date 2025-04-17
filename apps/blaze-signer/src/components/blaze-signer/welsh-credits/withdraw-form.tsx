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
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Withdraw</h2>
                <p className="card-description">
                    Withdraw WELSH tokens from this contract
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="withdraw-amount" className="label">Amount</label>
                        <input
                            id="withdraw-amount"
                            className="input"
                            placeholder="Enter amount (e.g. 10.5)"
                            value={withdrawAmount}
                            onChange={handleInputChange(setWithdrawAmount)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="withdraw-recipient" className="label">
                            Recipient (Optional)
                        </label>
                        <input
                            id="withdraw-recipient"
                            className="input"
                            placeholder="Leave empty to withdraw to your own account"
                            value={withdrawRecipient}
                            onChange={handleInputChange(setWithdrawRecipient)}
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !isWalletConnected || !withdrawAmount}
                    >
                        {isWithdrawing ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Withdrawing...
                            </>
                        ) : (
                            "Withdraw"
                        )}
                    </button>

                    {withdrawResult && (
                        <div className="result-box">
                            <p className="result-box-title">Result</p>
                            <div className="result-box-content">
                                <span className={withdrawResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {withdrawResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 