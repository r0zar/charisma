"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    uintCV,
    stringAsciiCV,
    principalCV,
    hexToCV,
    listCV,
    tupleCV
} from "@stacks/transactions"
import { Loader2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"
import {
    WELSH_CREDITS_CONTRACT,
    parseContract
} from "../../../constants/contracts"

interface BatchRedeemFormProps {
    network: StacksNetwork
    isWalletConnected: boolean
    onSuccess: () => void
    className?: string
}

type FunctionResult = {
    type: 'success' | 'error'
    message: string
}

interface BatchOperation {
    signature: string;
    amount: number;
    uuid: string;
    to: string;
}

export function BatchRedeemForm({
    network,
    isWalletConnected,
    onSuccess,
    className
}: BatchRedeemFormProps) {
    // Batch Redeem state
    const [operationsInput, setOperationsInput] = useState(`[
  {
    "signature": "0x...",
    "amount": 10,
    "uuid": "...",
    "to": "SP..."
  }
]`)
    const [isRedeemingBatch, setIsRedeemingBatch] = useState(false)
    const [batchRedeemResult, setBatchRedeemResult] = useState<FunctionResult | null>(null)
    const [parsedOperations, setParsedOperations] = useState<BatchOperation[] | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLTextAreaElement>) => {
        setter(e.target.value)
        setParsedOperations(null) // Reset parsed data on input change
        setParseError(null)
    }

    // Parse JSON input
    const parseInput = () => {
        setParseError(null)
        try {
            const parsed = JSON.parse(operationsInput);
            if (!Array.isArray(parsed)) {
                throw new Error("Input must be a JSON array.");
            }
            // Basic validation of structure
            parsed.forEach((op, index) => {
                if (!op.signature || !op.amount || !op.uuid || !op.to) {
                    throw new Error(`Operation at index ${index} is missing required fields (signature, amount, uuid, to).`);
                }
                if (typeof op.amount !== 'number') {
                    throw new Error(`Amount at index ${index} must be a number.`);
                }
            });
            setParsedOperations(parsed);
            alert(`Successfully parsed ${parsed.length} operations.`);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setParseError(`Invalid JSON: ${errorMsg}`);
            setParsedOperations(null);
        }
    };

    // Handle batch redeem
    const handleBatchRedeem = async () => {
        if (!isWalletConnected || !parsedOperations || parsedOperations.length === 0) {
            setBatchRedeemResult({
                type: 'error',
                message: 'Connect wallet and provide valid, parsed operations.'
            })
            return
        }

        setIsRedeemingBatch(true)
        setBatchRedeemResult(null)

        try {
            // Parse contract address and name
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)

            // Convert operations to Clarity list of tuples
            const clarityOperations = parsedOperations.map(op => {
                let signatureArg;
                try {
                    const cleanSignature = op.signature.startsWith('0x') ? op.signature.slice(2) : op.signature;
                    signatureArg = hexToCV(cleanSignature);
                } catch (e) {
                    throw new Error(`Invalid signature format for UUID ${op.uuid}: ${e}`);
                }

                return tupleCV({
                    signature: signatureArg,
                    amount: uintCV(op.amount),
                    uuid: stringAsciiCV(op.uuid),
                    to: principalCV(op.to)
                });
            });

            // Call the batch-redeem-notes function
            await request('stx_callContract', {
                contract: `${contractAddress}.${contractName}`,
                functionName: "batch-redeem-notes",
                functionArgs: [listCV(clarityOperations)]
            })

            // Set result after successful transaction
            setBatchRedeemResult({
                type: 'success',
                message: 'Batch redeem transaction submitted'
            })

            // Call the success callback
            setTimeout(onSuccess, 3000)

        } catch (error) {
            console.error("Error redeeming batch:", error)
            setBatchRedeemResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsRedeemingBatch(false)
        }
    }

    return (
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Batch Redeem Notes</h2>
                <p className="card-description">
                    Redeem multiple signed notes in a single transaction.
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="batch-operations" className="label">Operations (JSON Array)</label>
                        <textarea
                            id="batch-operations"
                            className="input h-40 font-mono text-xs"
                            placeholder='[{"signature": "0x...", "amount": 10, "uuid": "...", "to": "SP..."}, ...]'
                            value={operationsInput}
                            onChange={handleInputChange(setOperationsInput)}
                        />
                        <button type="button" className="button" onClick={parseInput}>Parse Input</button>
                        {parseError && <p className="text-destructive text-sm">{parseError}</p>}
                        {parsedOperations && <p className="text-primary text-sm">Parsed {parsedOperations.length} operations successfully.</p>}
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleBatchRedeem}
                        disabled={isRedeemingBatch || !isWalletConnected || !parsedOperations || parsedOperations.length === 0}
                    >
                        {isRedeemingBatch ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Submitting Batch...
                            </>
                        ) : (
                            "Submit Batch Redeem"
                        )}
                    </button>

                    {batchRedeemResult && (
                        <div className="result-box">
                            <p className="result-box-title">Result</p>
                            <div className="result-box-content">
                                <span className={batchRedeemResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {batchRedeemResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 