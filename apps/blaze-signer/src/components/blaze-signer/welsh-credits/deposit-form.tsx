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
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Deposit</h2>
                <p className="card-description">
                    Deposit WELSH tokens to this contract
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="deposit-amount" className="label">Amount</label>
                        <input
                            id="deposit-amount"
                            className="input"
                            placeholder="Enter amount (e.g. 10.5)"
                            value={depositAmount}
                            onChange={handleInputChange(setDepositAmount)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="deposit-recipient" className="label">
                            Recipient (Optional)
                        </label>
                        <input
                            id="deposit-recipient"
                            className="input"
                            placeholder="Leave empty to deposit to your own account"
                            value={depositRecipient}
                            onChange={handleInputChange(setDepositRecipient)}
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleDeposit}
                        disabled={isDepositing || !isWalletConnected || !depositAmount}
                    >
                        {isDepositing ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Depositing...
                            </>
                        ) : (
                            "Deposit"
                        )}
                    </button>

                    {depositResult && (
                        <div className="result-box">
                            <p className="result-box-title">Result</p>
                            <div className="result-box-content">
                                <span className={depositResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {depositResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 