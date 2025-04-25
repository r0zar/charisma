'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RedeemNoteForm } from './welsh-credits/redeem-note-form';
import { STACKS_MAINNET } from '@stacks/network';
import type { AddressEntry } from "@stacks/connect/dist/types/methods";
import { connect } from "@stacks/connect";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { fetchCallReadOnlyFunction, stringAsciiCV, ClarityType } from '@stacks/transactions';
import { BLAZE_SIGNER_CONTRACT, parseContract } from '../../constants/contracts';

// Mock function/values - Replace with your actual implementation
const getNetwork = () => STACKS_MAINNET; // Use the correct instance
const handleSuccess = () => { alert('Redemption Successful!'); }; // Replace with your success handler

// This component will safely use the useSearchParams hook
function SearchParamsReader() {
    const searchParams = useSearchParams();
    const sig = searchParams.get('sig') ?? undefined;
    const amount = searchParams.get('amount') ?? undefined;
    const uuid = searchParams.get('uuid') ?? undefined;

    return (
        <RedeemPageContentInner
            sig={sig}
            amount={amount}
            uuid={uuid}
        />
    );
}

// Inner component that doesn't directly use useSearchParams
function RedeemPageContentInner({ sig, amount, uuid }: {
    sig: string | undefined,
    amount: string | undefined,
    uuid: string | undefined
}) {
    // State for wallet details 
    const [isConnected, setIsConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // State for UUID status check
    const [isCheckingStatus, setIsCheckingStatus] = useState(true); // Start checking immediately
    const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

    const network = getNetwork();

    // Read from localStorage on component mount
    useEffect(() => {
        try {
            const storedAddresses = localStorage.getItem('addresses');
            if (storedAddresses) {
                const addresses: AddressEntry[] = JSON.parse(storedAddresses);
                // Assuming index 2 is mainnet, like in WalletConnector
                if (addresses.length > 2 && addresses[2]?.address) {
                    setWalletAddress(addresses[2].address);
                    setIsConnected(true);
                } else {
                    setIsConnected(false);
                    setWalletAddress(null);
                }
            } else {
                setIsConnected(false);
                setWalletAddress(null);
            }
        } catch (error) {
            console.error("Error reading wallet address from localStorage:", error);
            setIsConnected(false);
            setWalletAddress(null);
        }
    }, []);

    // Check UUID status on component mount or when UUID changes
    useEffect(() => {
        if (uuid) {
            const checkUuidStatus = async () => {
                setIsCheckingStatus(true);
                setIsAlreadySubmitted(false);
                setCheckError(null);
                try {
                    const [blazeAddress, blazeContractName] = parseContract(BLAZE_SIGNER_CONTRACT);
                    const result = await fetchCallReadOnlyFunction({
                        contractAddress: blazeAddress,
                        contractName: blazeContractName,
                        functionName: 'is-uuid-submitted',
                        functionArgs: [stringAsciiCV(uuid)],
                        network: STACKS_MAINNET,
                        senderAddress: blazeAddress,
                    });

                    if ('type' in result && result.type === ClarityType.BoolTrue) {
                        setIsAlreadySubmitted(true);
                    } else if ('type' in result && result.type === ClarityType.BoolFalse) {
                        setIsAlreadySubmitted(false);
                    } else {
                        throw new Error("Unexpected result type checking UUID status");
                    }
                } catch (err: any) {
                    console.error("Error checking UUID status on redeem page:", err);
                    setCheckError(`Failed to check note status: ${err.message || String(err)}`);
                } finally {
                    setIsCheckingStatus(false);
                }
            };
            checkUuidStatus();
        } else {
            // If no UUID, stop checking (or handle as invalid link)
            setIsCheckingStatus(false);
        }
    }, [uuid]); // Re-run if UUID changes

    // Instead of rejecting missing params, we'll just pass empty values and let the form handle it
    const hasAllParams = sig && amount && uuid;

    // Show Loading state for status check
    if (uuid && isCheckingStatus) {
        return (
            <div className="max-w-xl mx-auto my-8 p-8 text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin" />
                <p className="mt-4 text-muted-foreground">Checking note status...</p>
            </div>
        );
    }

    // Show Error state for status check
    if (checkError) {
        return (
            <div className="max-w-xl mx-auto my-8 p-8 text-center border border-destructive/20 bg-destructive/5 rounded-lg">
                <h2 className="text-lg font-semibold text-destructive">Status Check Failed</h2>
                <p className="text-destructive/80 mt-2">{checkError}</p>
            </div>
        );
    }

    // Show Already Submitted state
    if (isAlreadySubmitted) {
        return (
            <div className="max-w-xl mx-auto my-8 p-8 text-center border border-orange-200 bg-orange-50 rounded-lg">
                <h1 className="text-xl font-bold text-orange-700 mb-4">Note Already Redeemed</h1>
                <p className="text-orange-600">This note (identified by its UUID) has already been submitted and redeemed. It cannot be redeemed again.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-xl mx-auto my-8 px-4">
            {/* Main Content Area */}
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2 text-primary">Collect Your WELSH!</h1>
                <p className="text-muted-foreground text-lg">
                    {hasAllParams
                        ? "You're about to redeem a signed note to receive WELSH tokens."
                        : "Enter the note details below to redeem your WELSH tokens."
                    }
                </p>
            </div>

            {/* Pass data to the form component */}
            <RedeemNoteForm
                network={network}
                isWalletConnected={isConnected}
                onSuccess={handleSuccess}
                initialSignature={sig || ""}
                initialAmount={amount || ""}
                initialUuid={uuid || ""}
                initialRecipient={walletAddress || ""}
                connectedWalletAddress={walletAddress}
            />

            {/* Explanation Section */}
            <div className="mt-10 pt-6 border-t border-dashed border-border text-center">
                <h4 className="text-base font-semibold text-foreground mb-3">How does this work? (It's like cashing a check!)</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The original sender of these tokens previously signed a secure, off-chain message (like writing a check or IOU) authorizing this specific transfer.
                    <br />
                    This note contains their cryptographic signature, proving they approved sending {amount || 'these'} WELSH tokens. Each note also includes a unique ID (UUID) to prevent it from being used more than once.
                    <br /><br />
                    You are now submitting this pre-authorized note to the Stacks blockchain (secured by Bitcoin) to claim the funds into the recipient address specified above. The system verifies the original sender's signature and checks the UUID to ensure the transaction is valid and hasn't already been processed.
                    <br /><br />
                    {!isConnected ? (
                        <strong className="text-primary">Please connect your wallet using the button at the top of the page to redeem your tokens.</strong>
                    ) : hasAllParams ? (
                        "Since you're seeing this page, it means the note is ready to be redeemed – you're the first to cash this check!"
                    ) : (
                        "If you have a redemption QR code, scan it to automatically fill out the form."
                    )}
                    <br /><br />
                    This "sign first, submit later" method allows for secure transfers without requiring the original sender to be online now, enabling cool features like off-chain payments and efficient processing.
                </p>
            </div>
        </div>
    );
}

// Export the component with Suspense boundary
export function RedeemPageContent() {
    return (
        <Suspense fallback={<div>Loading redemption form...</div>}>
            <SearchParamsReader />
        </Suspense>
    );
} 