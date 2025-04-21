"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    uintCV,
    stringAsciiCV,
    principalCV,
    hexToCV
} from "@stacks/transactions"
import { Loader2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"
import {
    WELSH_CREDITS_CONTRACT,
    parseContract
} from "../../../constants/contracts"
import { bufferFromHex } from "@stacks/transactions/dist/cl"

interface RedeemNoteFormProps {
    network: StacksNetwork
    isWalletConnected: boolean
    onSuccess: () => void
    className?: string
    initialSignature?: string
    initialAmount?: string
    initialUuid?: string
    initialRecipient?: string
    connectedWalletAddress?: string | null
}

type FunctionResult = {
    type: 'success' | 'error'
    message: string
}

export function RedeemNoteForm({
    network,
    isWalletConnected,
    onSuccess,
    className,
    initialSignature = "",
    initialAmount = "",
    initialUuid = "",
    initialRecipient = "",
    connectedWalletAddress = null
}: RedeemNoteFormProps) {
    // Redeem Note state
    const [redeemSignature, setRedeemSignature] = useState(initialSignature)
    const [redeemAmount, setRedeemAmount] = useState(initialAmount)
    const [redeemUuid, setRedeemUuid] = useState(initialUuid)
    const [redeemTo, setRedeemTo] = useState(initialRecipient)
    const [isRedeeming, setIsRedeeming] = useState(false)
    const [redeemResult, setRedeemResult] = useState<FunctionResult | null>(null)

    const handleUseMyAddress = () => {
        if (connectedWalletAddress) {
            setRedeemTo(connectedWalletAddress);
        }
    };

    // Input change handlers for all fields
    const handleSignatureChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setRedeemSignature(e.target.value);
    };

    const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
        // Allow only numbers
        const value = e.target.value.replace(/[^0-9]/g, '');
        setRedeemAmount(value);
    };

    const handleUuidChange = (e: ChangeEvent<HTMLInputElement>) => {
        setRedeemUuid(e.target.value);
    };

    const handleRecipientChange = (e: ChangeEvent<HTMLInputElement>) => {
        setRedeemTo(e.target.value);
    };

    // Check if values came from URL or are being manually entered
    const areParamsFromUrl = Boolean(initialSignature && initialAmount && initialUuid);

    // Handle redeem note
    const handleRedeemNote = async () => {
        if (!isWalletConnected || !redeemSignature || !redeemAmount || !redeemUuid || !redeemTo) {
            setRedeemResult({
                type: 'error',
                message: 'All fields are required'
            })
            return
        }

        setIsRedeeming(true)
        setRedeemResult(null)

        try {
            // Parse contract address and name
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)

            // Call the redeem-note function
            await request('stx_callContract', {
                contract: `${contractAddress}.${contractName}`,
                functionName: "redeem-note",
                functionArgs: [
                    bufferFromHex(redeemSignature),
                    uintCV(parseInt(redeemAmount, 10)),
                    stringAsciiCV(redeemUuid),
                    principalCV(redeemTo)
                ]
            })

            // Set result after successful transaction
            setRedeemResult({
                type: 'success',
                message: 'Note redemption transaction submitted'
            })

            // Call the success callback
            setTimeout(onSuccess, 3000)

        } catch (error) {
            console.error("Error redeeming note:", error)
            setRedeemResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsRedeeming(false)
        }
    }

    return (
        <div className="w-full border border-border rounded-lg bg-card p-6">
            {/* Amount Display - Center Stage */}
            <div className="text-center mb-8 pb-6 border-b border-border">
                <label className="block text-sm font-medium text-foreground mb-2">You are redeeming:</label>
                {areParamsFromUrl ? (
                    <div className="text-4xl font-bold text-green-600 leading-tight">
                        {redeemAmount || '0'}
                        <span className="text-2xl font-normal ml-1">WELSH</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center">
                        <input
                            type="text"
                            value={redeemAmount}
                            onChange={handleAmountChange}
                            placeholder="Amount"
                            className="text-center w-32 text-3xl font-bold text-green-600 bg-transparent border-b-2 border-border focus:border-primary focus:outline-none"
                        />
                        <span className="text-xl font-normal ml-1">WELSH</span>
                    </div>
                )}
            </div>

            {/* Section: Form Fields */}
            <div className="space-y-4">
                {/* Only show these fields if we don't have URL params */}
                {!areParamsFromUrl && (
                    <>
                        <div>
                            <label htmlFor="redeem-signature" className="block text-sm font-medium text-foreground mb-1">
                                Signature:
                            </label>
                            <textarea
                                id="redeem-signature"
                                className="w-full rounded-md border border-border bg-background p-2 text-sm font-mono h-20"
                                placeholder="Enter note signature (hex format)"
                                value={redeemSignature}
                                onChange={handleSignatureChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="redeem-uuid" className="block text-sm font-medium text-foreground mb-1">
                                UUID:
                            </label>
                            <input
                                id="redeem-uuid"
                                type="text"
                                className="w-full rounded-md border border-border bg-background p-2 text-sm font-mono"
                                placeholder="Enter note UUID"
                                value={redeemUuid}
                                onChange={handleUuidChange}
                            />
                        </div>
                    </>
                )}

                {/* Recipient input + Button */}
                <div>
                    <label htmlFor="redeem-to" className="block text-sm font-medium text-foreground mb-1">
                        To Wallet Address:
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="redeem-to"
                            className="flex-grow rounded-md border border-border bg-background px-3 py-2 text-sm"
                            placeholder="Enter address or use yours"
                            value={redeemTo}
                            onChange={handleRecipientChange}
                        />
                        {/* Use My Address Button */}
                        <button
                            type="button"
                            onClick={handleUseMyAddress}
                            disabled={!connectedWalletAddress}
                            className={`px-3 py-2 rounded-md border border-border text-sm whitespace-nowrap flex-shrink-0 ${connectedWalletAddress
                                ? 'bg-muted hover:bg-muted/80 text-foreground cursor-pointer'
                                : 'bg-muted/50 text-muted cursor-not-allowed'
                                }`}
                        >
                            Use Mine
                        </button>
                    </div>
                </div>

                {/* Remove wallet connection prompt and simplify the button UI */}
                <button
                    className={`w-full py-3 px-6 rounded-md text-white font-semibold flex items-center justify-center ${redeemTo && redeemSignature && redeemAmount && redeemUuid && isWalletConnected
                        ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                        : 'bg-gray-400 cursor-not-allowed opacity-70'
                        }`}
                    onClick={handleRedeemNote}
                    disabled={isRedeeming || !isWalletConnected || !redeemSignature || !redeemAmount || !redeemUuid || !redeemTo}
                >
                    {isRedeeming ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing Redemption...
                        </>
                    ) : !isWalletConnected ? (
                        'Connect Wallet to Redeem'
                    ) : (
                        '✨ Redeem Now!'
                    )}
                </button>

                {/* Result box */}
                {redeemResult && (
                    <div className={`mt-4 p-4 rounded-md border ${redeemResult.type === 'success'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                        }`}>
                        <p className={`font-semibold ${redeemResult.type === 'success' ? 'text-green-700' : 'text-red-700'
                            }`}>
                            {redeemResult.type === 'success' ? 'Success!' : 'Error:'}
                        </p>
                        <p className={`mt-1 text-sm ${redeemResult.type === 'success' ? 'text-green-800' : 'text-red-800'
                            }`}>
                            {redeemResult.message}
                        </p>
                    </div>
                )}
            </div>

            {/* Technical Details (Minimized) - only show this for URL-provided params */}
            {areParamsFromUrl && (
                <div className="mt-8 pt-4 border-t border-border text-center">
                    <details className="cursor-pointer">
                        <summary className="text-xs text-muted inline-block">Show Technical Details</summary>
                        <div className="mt-2 text-xs font-mono break-words text-left bg-muted/20 p-2 rounded-md">
                            <p><strong>Signature:</strong> {redeemSignature || '-'}</p>
                            <p className="mt-1"><strong>UUID:</strong> {redeemUuid || '-'}</p>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
} 