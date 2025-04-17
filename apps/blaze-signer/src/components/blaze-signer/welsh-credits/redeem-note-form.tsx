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

    // Only need handler for the editable field (Recipient)
    const handleRecipientChange = (e: ChangeEvent<HTMLInputElement>) => {
        setRedeemTo(e.target.value);
    };

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
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', backgroundColor: '#f9fafb' }}>
            <div style={{ padding: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Redeem Note</h2>
                <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>
                    Redeem a signed note to transfer funds from the signer to a recipient
                </p>
            </div>
            <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Signature Display */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>Signature</label>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', padding: '0.5rem 0.75rem', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', border: '1px solid #d1d5db', overflowWrap: 'break-word' }}>
                            {redeemSignature || '-'}
                        </div>
                    </div>

                    {/* Amount Display */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>Amount</label>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', padding: '0.5rem 0.75rem', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}>
                            {redeemAmount || '-'}
                        </div>
                    </div>

                    {/* UUID Display */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>UUID</label>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', padding: '0.5rem 0.75rem', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}>
                            {redeemUuid || '-'}
                        </div>
                    </div>

                    {/* Recipient input + Button (remains editable) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label htmlFor="redeem-to" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>Recipient</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                id="redeem-to"
                                style={{ flexGrow: 1, borderRadius: '0.375rem', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem' }}
                                placeholder="Enter recipient address"
                                value={redeemTo}
                                onChange={handleRecipientChange}
                            />
                            <button
                                type="button"
                                onClick={handleUseMyAddress}
                                disabled={!connectedWalletAddress}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: connectedWalletAddress ? '#d1d5db' : '#e5e7eb',
                                    color: connectedWalletAddress ? '#1f2937' : '#9ca3af',
                                    borderRadius: '0.375rem',
                                    cursor: connectedWalletAddress ? 'pointer' : 'not-allowed',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Use My Address
                            </button>
                        </div>
                    </div>

                    {!isWalletConnected && (
                        <p style={{ color: '#ea580c', textAlign: 'center', marginTop: '0.5rem' }}>
                            Please connect your wallet to redeem.
                        </p>
                    )}

                    <button
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: isWalletConnected && redeemSignature && redeemAmount && redeemUuid && redeemTo ? '#2563eb' : '#9ca3af',
                            color: 'white',
                            borderRadius: '0.375rem',
                            width: '100%',
                            cursor: isWalletConnected && redeemSignature && redeemAmount && redeemUuid && redeemTo ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isWalletConnected && redeemSignature && redeemAmount && redeemUuid && redeemTo ? 1 : 0.7
                        }}
                        onClick={handleRedeemNote}
                        disabled={isRedeeming || !isWalletConnected || !redeemSignature || !redeemAmount || !redeemUuid || !redeemTo}
                    >
                        {isRedeeming ? (
                            <>
                                <Loader2 style={{ marginRight: '0.5rem', height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                                Redeeming...
                            </>
                        ) : (
                            "Redeem Note"
                        )}
                    </button>

                    {redeemResult && (
                        <div className="result-box">
                            <p className="result-box-title">Result</p>
                            <div className="result-box-content">
                                <span className={redeemResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {redeemResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 