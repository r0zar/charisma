"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, ClarityType, stringAsciiCV } from "@stacks/transactions"
import { bufferFromHex } from "@stacks/transactions/dist/cl"
import { Loader2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"
import { BLAZE_SIGNER_CONTRACT, generateUUID } from "../../constants/contracts"

interface SubmitSignatureProps {
    network: StacksNetwork
    walletAddress: string
    className?: string
}

type SubmitError = {
    type: 'error'
    message: string
}

type SubmitSuccess = {
    type: 'success'
    txid: string
}

type SubmitResult = SubmitError | SubmitSuccess | null

export function SubmitSignature({ network, walletAddress, className }: SubmitSignatureProps) {
    const [opcode, setOpcode] = useState("")
    const [uuid, setUuid] = useState("")
    const [signature, setSignature] = useState("")
    const [submitResult, setSubmitResult] = useState<SubmitResult>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Function to submit a signature by calling the contract
    const handleSubmitSignature = async () => {
        if (!opcode || !uuid || !signature) {
            setSubmitResult({
                type: 'error',
                message: "All fields are required."
            })
            return
        }

        setIsSubmitting(true)
        setSubmitResult(null)

        try {
            // Parse the contract address and name from constant
            const [contractAddress, contractName] = BLAZE_SIGNER_CONTRACT.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid signer contract format in default configuration")
            }

            // Call the submit function on the contract
            const result = await request('stx_callContract', {
                contract: contractAddress + "." + contractName as any,
                functionName: "submit",
                functionArgs: [
                    bufferFromHex(signature),
                    stringAsciiCV(opcode),
                    stringAsciiCV(uuid),
                ],
            }) as any

            // Check if the result is a response with principal
            if (!result.error) {
                setSubmitResult({
                    type: 'success',
                    txid: result.txid
                })
            } else {
                throw new Error("Invalid signature or UUID already submitted")
            }

        } catch (error) {
            console.error("Error submitting signature:", error)
            setSubmitResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Submit Signature</h2>
                <p className="card-description">
                    Submit a signature to verify and consume a UUID. The contract must be the caller.
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="submit-wallet" className="label">
                            Connected Wallet (Principal)
                        </label>
                        <input
                            id="submit-wallet"
                            className="input"
                            value={walletAddress || "Not connected"}
                            disabled
                            style={{
                                backgroundColor: 'var(--border)',
                                cursor: 'not-allowed',
                                opacity: walletAddress ? 1 : 0.7
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-opcode" className="label">
                            Opcode (string-ascii 64)
                        </label>
                        <input
                            id="submit-opcode"
                            className="input"
                            placeholder="e.g. TRANSFER_10"
                            value={opcode}
                            onChange={handleInputChange(setOpcode)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-uuid" className="label">
                            UUID (string-ascii 64)
                        </label>
                        <div className="flex space-x-2">
                            <input
                                id="submit-uuid"
                                className="input"
                                placeholder="Enter unique request ID"
                                value={uuid}
                                onChange={handleInputChange(setUuid)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-signature" className="label">
                            Signature (buff 65)
                        </label>
                        <input
                            id="submit-signature"
                            className="input"
                            placeholder="0x..."
                            value={signature}
                            onChange={handleInputChange(setSignature)}
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleSubmitSignature}
                        disabled={isSubmitting || !opcode || !uuid || !signature || !walletAddress}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            "Submit Signature"
                        )}
                    </button>

                    <div className="result-box">
                        <p className="result-box-title">Submit Result</p>
                        <div className="result-box-content">
                            {isSubmitting ? (
                                "Submitting signature..."
                            ) : !submitResult ? (
                                "Result will appear here..."
                            ) : submitResult.type === 'error' ? (
                                <span className="text-destructive">{submitResult.message}</span>
                            ) : (
                                <span className="text-primary">TxID: {submitResult.txid}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 