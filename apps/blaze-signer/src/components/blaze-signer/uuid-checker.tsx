"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, stringAsciiCV, ClarityType } from "@stacks/transactions"
import { Loader2 } from "@repo/ui/icons"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/card"
import { cn } from "@repo/ui/utils"

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
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Check UUID Status</CardTitle>
                <CardDescription>
                    Check if a UUID has been submitted to the signer contract
                </CardDescription>
            </CardHeader>

            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="uuid" className="block text-sm font-medium text-foreground">
                            UUID
                        </label>
                        <input
                            id="uuid"
                            type="text"
                            value={uuid}
                            onChange={handleInputChange(setUuid)}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter UUID to check"
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={checkUuidStatus}
                        disabled={isChecking || !uuid || !signerContract}
                    >
                        {isChecking ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            "Check UUID"
                        )}
                    </Button>

                    {checkResult && (
                        <div className="mt-4 p-4 rounded-md border border-border">
                            <p className="text-sm font-medium mb-1">Status</p>
                            <div className="text-base">
                                {checkResult.startsWith("Error") ? (
                                    <span className="text-destructive">{checkResult}</span>
                                ) : checkResult.includes("has been submitted") ? (
                                    <span className="text-primary">{checkResult}</span>
                                ) : (
                                    <span className="text-muted-foreground">{checkResult}</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 