"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, stringAsciiCV, ClarityType, principalCV } from "@stacks/transactions"
import { bufferFromHex } from "@stacks/transactions/dist/cl"
import { Loader2 } from "@repo/ui/icons"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"

interface VerifySignatureProps {
    network: StacksNetwork
    walletAddress: string
    className?: string
}

type VerificationError = {
    type: 'error'
    message: string
}

type VerificationSuccess = {
    type: 'success'
    signer: string
}

type VerificationResult = VerificationError | VerificationSuccess | null

export function VerifySignature({ network, walletAddress, className }: VerifySignatureProps) {
    const [coreContract, setCoreContract] = useState("")
    const [opcode, setOpcode] = useState("")
    const [uuid, setUuid] = useState("")
    const [signature, setSignature] = useState("")
    const [verificationResult, setVerificationResult] = useState<VerificationResult>(null)
    const [isVerifying, setIsVerifying] = useState(false)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Function to verify a signature by calling the contract
    const handleVerifySignature = async () => {
        if (!signature || !coreContract || !opcode || !uuid) {
            setVerificationResult({
                type: 'error',
                message: "All fields are required."
            })
            return
        }

        setIsVerifying(true)
        setVerificationResult(null)

        try {
            // Parse the contract address and name from constant
            const [contractAddress, contractName] = BLAZE_SIGNER_CONTRACT.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid signer contract format in default configuration")
            }

            // Call the get-signer-from-args function on the contract
            const result: any = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "get-signer-from-args",
                functionArgs: [
                    bufferFromHex(signature),
                    principalCV(coreContract),
                    stringAsciiCV(opcode),
                    stringAsciiCV(uuid),
                ],
                network,
                senderAddress: walletAddress || contractAddress,
            })

            // Check if the result is a response with principal
            if (result.type === ClarityType.ResponseOk) {
                const principal = result.value.value
                setVerificationResult({
                    type: 'success',
                    signer: principal
                })
            } else {
                throw new Error("Invalid signature")
            }

        } catch (error) {
            console.error("Error verifying signature:", error)
            setVerificationResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Get Signer by Data Properties</h2>
                <p className="card-description">
                    Verify a signature matches the original request data.
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="core-contract" className="label">
                            Subnet Contract (principal)
                        </label>
                        <input
                            id="core-contract"
                            className="input"
                            placeholder="SP... (Contract that called 'submit')"
                            value={coreContract}
                            onChange={handleInputChange(setCoreContract)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="opcode" className="label">
                            Opcode (string-ascii 64)
                        </label>
                        <input
                            id="opcode"
                            className="input"
                            placeholder="action=transfer;token=ST...;amount=100"
                            value={opcode}
                            onChange={handleInputChange(setOpcode)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="uuid" className="label">
                            UUID (string-ascii 64)
                        </label>
                        <input
                            id="uuid"
                            className="input"
                            placeholder="Enter UUID"
                            value={uuid}
                            onChange={handleInputChange(setUuid)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="verify-signature" className="label">
                            Signature (buff 65)
                        </label>
                        <input
                            id="verify-signature"
                            className="input"
                            placeholder="0x..."
                            value={signature}
                            onChange={handleInputChange(setSignature)}
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleVerifySignature}
                        disabled={isVerifying || !coreContract || !opcode || !uuid || !signature}
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            "Recover Signer"
                        )}
                    </button>

                    <div className="result-box md:col-span-2">
                        <p className="result-box-title">Verification Result</p>
                        <div className="result-box-content">
                            {isVerifying ? (
                                "Verifying signature..."
                            ) : !verificationResult ? (
                                "Result will appear here..."
                            ) : verificationResult.type === 'error' ? (
                                <span className="text-destructive">{verificationResult.message}</span>
                            ) : (
                                <span className="text-primary">Signer: {verificationResult.signer}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 