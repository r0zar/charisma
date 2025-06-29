"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { stringAsciiCV, bufferCV, optionalCVOf, noneCV, uintCV, principalCV } from "@stacks/transactions"
import { Loader2 } from "lucide-react"
import { request } from "@stacks/connect"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card"
import { cn } from "../ui/utils"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"

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
    const [intent, setIntent] = useState("")
    const [opcodeOptional, setOpcodeOptional] = useState("")
    const [amountOptional, setAmountOptional] = useState("")
    const [targetOptional, setTargetOptional] = useState("")
    const [uuid, setUuid] = useState("")
    const [signature, setSignature] = useState("")
    const [submitResult, setSubmitResult] = useState<SubmitResult>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Added Helper Handlers (similar to hash-generator)
    const handleHexBufferChange = (setter: React.Dispatch<React.SetStateAction<string>>, maxLengthBytes: number) => (e: ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value.replace(/[^0-9a-fA-F]/g, '');
        if (hex.length / 2 <= maxLengthBytes) {
            setter(hex);
        } else {
            setter(hex.substring(0, maxLengthBytes * 2));
        }
    };
    const handleUintChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setter(val);
    };

    // Function to submit a signature by calling the contract
    const handleSubmitSignature = async () => {
        if (!intent || !uuid || !signature) {
            setSubmitResult({
                type: 'error',
                message: "Intent, UUID, and Signature fields are required."
            })
            return
        }
        if (intent.length > 32) {
            setSubmitResult({ type: 'error', message: "Intent exceeds 32 ASCII characters" })
            return
        }
        if (opcodeOptional && (opcodeOptional.length === 0 || opcodeOptional.length % 2 !== 0 || opcodeOptional.length / 2 > 16)) {
            setSubmitResult({ type: 'error', message: "Optional Opcode must be a valid hex string representing max 16 bytes" })
            return
        }
        if (targetOptional && (!targetOptional.startsWith('SP') && !targetOptional.startsWith('ST'))) {
            setSubmitResult({ type: 'error', message: "Optional Target does not look like a valid principal address" })
            return
        }
        if (amountOptional && !/^\d+$/.test(amountOptional)) {
            setSubmitResult({ type: 'error', message: "Optional Amount must be a valid positive integer" })
            return
        }
        // Basic check for signature format (hex, 130 chars/65 bytes)
        const cleanSignature = signature.startsWith('0x') ? signature.substring(2) : signature;
        if (!/^[0-9a-fA-F]+$/.test(cleanSignature) || cleanSignature.length !== 130) {
            setSubmitResult({ type: 'error', message: "Signature must be a 65-byte hex string (130 characters)" })
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

            // Prepare optional arguments: Use optionalCVOf only when there IS a value.
            const opcodeArg = opcodeOptional ? optionalCVOf(bufferCV(Buffer.from(opcodeOptional, 'hex'))) : noneCV();
            const amountArg = amountOptional ? optionalCVOf(uintCV(amountOptional)) : noneCV();
            const targetArg = targetOptional ? optionalCVOf(principalCV(targetOptional)) : noneCV();

            // Call the 'execute' function using request ('stx_callContract')
            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: "execute",
                functionArgs: [
                    bufferCV(Buffer.from(cleanSignature, 'hex')), // signature (buff 65)
                    stringAsciiCV(intent),                       // intent (string-ascii 32)
                    opcodeArg,                                   // opcode (optional (buff 16))
                    amountArg,                                   // amount (optional uint)
                    targetArg,                                   // target (optional principal)
                    stringAsciiCV(uuid),                         // uuid (string-ascii 36)
                ],
                network: "mainnet"
            };
            const result = await request('stx_callContract', params) as any // Using any for result

            // Check if the result indicates a successful broadcast (has txid)
            if (result && result.txid) {
                setSubmitResult({
                    type: 'success',
                    txid: result.txid
                })
            } else {
                // Extract potential error message if available
                const errorMessage = result?.error?.message || "Transaction failed or was rejected. Check console.";
                console.error("Submission Error Raw:", result);
                throw new Error(`Submission Failed: ${errorMessage}`);
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
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Submit Signature</CardTitle>
                <CardDescription>
                    Submit a signed intent to the contract for execution and UUID consumption.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="submit-wallet" className="block text-sm font-medium text-foreground">
                            Connected Wallet (Sender)
                        </label>
                        <input
                            id="submit-wallet"
                            className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            value={walletAddress || "Not connected"}
                            disabled
                            style={{
                                opacity: walletAddress ? 1 : 0.7
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-intent" className="block text-sm font-medium text-foreground">
                            Intent (string-ascii 32) <span className="text-destructive">*</span>
                        </label>
                        <input
                            id="submit-intent"
                            maxLength={32}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="e.g., TRANSFER, MINT"
                            value={intent}
                            onChange={handleInputChange(setIntent)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-opcode-optional" className="block text-sm font-medium text-foreground">
                            Opcode (Optional, hex buffer 16)
                        </label>
                        <input
                            id="submit-opcode-optional"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (max 32 hex chars)"
                            value={opcodeOptional}
                            onChange={handleHexBufferChange(setOpcodeOptional, 16)}
                        />
                        {opcodeOptional && (opcodeOptional.length % 2 !== 0) && <p className="text-xs text-destructive">Hex string must have an even number of characters.</p>}
                        {opcodeOptional && (opcodeOptional.length / 2 > 16) && <p className="text-xs text-destructive">Hex string represents more than 16 bytes.</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-amount-optional" className="block text-sm font-medium text-foreground">
                            Amount (Optional, uint)
                        </label>
                        <input
                            id="submit-amount-optional"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="e.g., 1000000"
                            value={amountOptional}
                            onChange={handleUintChange(setAmountOptional)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-target-optional" className="block text-sm font-medium text-foreground">
                            Target (Optional, principal)
                        </label>
                        <input
                            id="submit-target-optional"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="SP... or ST..."
                            value={targetOptional}
                            onChange={handleInputChange(setTargetOptional)}
                        />
                        {targetOptional && (!targetOptional.startsWith('SP') && !targetOptional.startsWith('ST')) && <p className="text-xs text-destructive">Principal should start with SP or ST.</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-uuid" className="block text-sm font-medium text-foreground">
                            UUID (string-ascii 36) <span className="text-destructive">*</span>
                        </label>
                        <input
                            id="submit-uuid"
                            maxLength={36}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter unique request ID (max 36 chars)"
                            value={uuid}
                            onChange={handleInputChange(setUuid)}
                        />
                        {uuid && uuid.length > 36 && <p className="text-xs text-destructive">UUID exceeds 36 characters.</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="submit-signature" className="block text-sm font-medium text-foreground">
                            Signature (hex buffer 65) <span className="text-destructive">*</span>
                        </label>
                        <input
                            id="submit-signature"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (130 hex characters)"
                            value={signature}
                            onChange={handleInputChange(setSignature)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleSubmitSignature}
                        disabled={isSubmitting || !intent || !uuid || !signature || !walletAddress}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="ml-2">Submitting...</span>
                            </>
                        ) : (
                            "Submit Signature"
                        )}
                    </Button>

                    <div className="mt-4 p-4 rounded-md border border-border">
                        <p className="text-sm font-medium mb-1">Submit Result</p>
                        <div className="font-mono text-sm break-all">
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
            </CardContent>
        </Card>
    )
} 