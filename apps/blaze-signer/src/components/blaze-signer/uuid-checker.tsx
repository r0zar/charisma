"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, stringAsciiCV, ClarityType } from "@stacks/transactions"
import { Loader2 } from "@repo/ui/icons"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"

interface UuidCheckerProps {
    network: StacksNetwork
    walletAddress: string
    className?: string
}

export function UuidChecker({ network, walletAddress, className }: UuidCheckerProps) {
    // State management
    const [uuid, setUuid] = useState("")
    const [signerContract, setSignerContract] = useState(BLAZE_SIGNER_CONTRACT)
    const [isChecking, setIsChecking] = useState(false)
    const [checkResult, setCheckResult] = useState<string | null>(null)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Function to check UUID status
    const checkUuidStatus = async () => {
        if (!uuid || !signerContract) {
            alert("Both UUID and signer contract are required.")
            return
        }

        setIsChecking(true)
        setCheckResult(null)

        try {
            // Parse the contract address and name
            const [contractAddress, contractName] = signerContract.split(".")

            if (!contractAddress || !contractName) {
                throw new Error("Invalid signer contract format")
            }

            // Call the is-uuid-submitted function
            const result = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "is-uuid-submitted",
                functionArgs: [stringAsciiCV(uuid)],
                network,
                senderAddress: walletAddress || contractAddress,
            })

            // Check if the result is a boolean CV
            if ('type' in result && result.type === ClarityType.BoolTrue) {
                setCheckResult("UUID has been submitted")
            } else if ('type' in result && result.type === ClarityType.BoolFalse) {
                setCheckResult("UUID has not been submitted")
            } else {
                throw new Error("Unexpected result type from contract")
            }

        } catch (error) {
            console.error("Error checking UUID:", error)
            setCheckResult(`Error: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
            setIsChecking(false)
        }
    }

    return (
        <div className={`card ${className || ""}`}>
            <div className="card-header">
                <h2 className="card-title">Check UUID Status</h2>
                <p className="card-description">
                    Check if a UUID has been submitted to the signer contract
                </p>
            </div>

            <div className="card-content">
                <div className="space-y-4">

                    <div className="space-y-2">
                        <label htmlFor="uuid" className="label">
                            UUID
                        </label>
                        <input
                            id="uuid"
                            type="text"
                            value={uuid}
                            onChange={handleInputChange(setUuid)}
                            className="input"
                            placeholder="Enter UUID to check"
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={checkUuidStatus}
                        disabled={isChecking || !uuid || !signerContract}
                    >
                        {isChecking ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            "Check UUID"
                        )}
                    </button>

                    {checkResult && (
                        <div className="result-box">
                            <p className="result-box-title">Status</p>
                            <div className="result-box-content">
                                {checkResult.startsWith("Error") ? (
                                    <span className="text-destructive">{checkResult}</span>
                                ) : checkResult.includes("has been submitted") ? (
                                    <span className="text-primary">{checkResult}</span>
                                ) : (
                                    <span className="text-muted">{checkResult}</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 