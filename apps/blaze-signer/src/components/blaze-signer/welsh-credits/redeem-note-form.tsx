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
        <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: '#ffffff', padding: '1.5rem' }}>

            {/* Amount Display - Center Stage */}
            <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <label style={{ display: 'block', fontSize: '1rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>You are redeeming:</label>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#16a34a', lineHeight: '1.2' }}>
                    {redeemAmount || '0'}
                    <span style={{ fontSize: '1.5rem', fontWeight: 'normal', marginLeft: '0.25rem' }}>WELSH</span>
                </div>
            </div>

            {/* Section: Recipient & Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Recipient input + Button */}
                <div>
                    <label htmlFor="redeem-to" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#1f2937', marginBottom: '0.25rem' }}>To Wallet Address:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            id="redeem-to"
                            style={{ flexGrow: 1, borderRadius: '0.375rem', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                            placeholder="Enter address or use yours"
                            value={redeemTo}
                            onChange={handleRecipientChange}
                        />
                        {/* Use My Address Button (Style refined slightly) */}
                        <button
                            type="button"
                            onClick={handleUseMyAddress}
                            disabled={!connectedWalletAddress}
                            style={{
                                padding: '0.5rem 0.75rem',
                                backgroundColor: connectedWalletAddress ? '#f3f4f6' : '#e5e7eb', // Lightest Grays
                                color: connectedWalletAddress ? '#374151' : '#9ca3af',
                                borderRadius: '0.375rem',
                                cursor: connectedWalletAddress ? 'pointer' : 'not-allowed',
                                whiteSpace: 'nowrap',
                                border: '1px solid #d1d5db',
                                fontSize: '0.875rem',
                                flexShrink: 0 // Prevent button from shrinking
                            }}
                        >
                            Use Mine
                        </button>
                    </div>
                </div>

                {/* Conditional message or Redeem button */}
                {!isWalletConnected ? (
                    <div style={{ backgroundColor: '#fffbeb', padding: '0.75rem 1rem', borderRadius: '0.375rem', border: '1px solid #fef3c7', textAlign: 'center' }}>
                        <p style={{ color: '#b45309', fontSize: '0.875rem', fontWeight: '500' }}>
                            Please connect your wallet to redeem.
                        </p>
                    </div>
                ) : (
                    <button
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: redeemTo ? '#16a34a' : '#9ca3af', // Green when active, Gray when disabled
                            color: 'white',
                            borderRadius: '0.375rem',
                            width: '100%',
                            cursor: redeemTo ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: redeemTo ? 1 : 0.7,
                            fontSize: '1rem',
                            fontWeight: '600'
                        }}
                        onClick={handleRedeemNote}
                        disabled={isRedeeming || !isWalletConnected || !redeemSignature || !redeemAmount || !redeemUuid || !redeemTo}
                    >
                        {isRedeeming ? (
                            <>
                                <Loader2 style={{ marginRight: '0.5rem', height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                                Processing Redemption...
                            </>
                        ) : (
                            '✨ Redeem Now!'
                        )}
                    </button>
                )}

                {/* Result box */}
                {redeemResult && (
                    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.375rem', border: `1px solid ${redeemResult.type === 'success' ? '#bbf7d0' : '#fecaca'}`, backgroundColor: `${redeemResult.type === 'success' ? '#f0fdf4' : '#fef2f2'}` }}>
                        <p style={{ fontWeight: '600', color: `${redeemResult.type === 'success' ? '#15803d' : '#b91c1c'}` }}>{redeemResult.type === 'success' ? 'Success!' : 'Error:'}</p>
                        <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: `${redeemResult.type === 'success' ? '#166534' : '#991b1b'}` }}>
                            {redeemResult.message}
                        </p>
                    </div>
                )}
            </div>

            {/* Technical Details (Minimized) */}
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                <details style={{ cursor: 'pointer' }}>
                    <summary style={{ fontSize: '0.75rem', color: '#6b7280', display: 'inline-block' }}>Show Technical Details</summary>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#4b5563', fontFamily: 'monospace', overflowWrap: 'break-word', textAlign: 'left', backgroundColor: '#f9fafb', padding: '0.5rem', borderRadius: '0.25rem' }}>
                        <p><strong>Signature:</strong> {redeemSignature || '-'}</p>
                        <p style={{ marginTop: '0.25rem' }}><strong>UUID:</strong> {redeemUuid || '-'}</p>
                    </div>
                </details>
            </div>
        </div>
    );
} 